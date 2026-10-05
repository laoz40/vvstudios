import { ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { unarchivePackageForNewUnpaidInvoice } from "#convex/lib/packages/packageArchive";
import { archivePackageWhenFullyDone } from "#convex/services/packages/packageArchive";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import { getStripeInvoiceByStripeInvoiceId } from "#convex/lib/stripe/stripeInvoices";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
import { unarchiveSessionForNewUnpaidInvoice } from "#convex/lib/sessions/sessionArchive";
import { archiveSessionWhenFullyDone } from "#convex/services/sessions/sessionArchive";
import { type StripeInvoiceInsertResult } from "#convex/lib/stripe/stripeInvoices";

function keepInsertResult<T>(insertResult: T) {
	return () => insertResult;
}

function recoverInsertResult<T>(insertResult: T) {
	return () => ok(insertResult);
}

function unarchiveSessionAndKeepInsertResult(
	ctx: MutationCtx,
	insertResult: StripeInvoiceInsertResult
) {
	return (session: Doc<"bookings">) =>
		unarchiveSessionForNewUnpaidInvoice(ctx, session).map(keepInsertResult(insertResult));
}

function unarchivePackageAndKeepInsertResult(
	ctx: MutationCtx,
	insertResult: StripeInvoiceInsertResult
) {
	return (packageRecord: Doc<"packages">) =>
		unarchivePackageForNewUnpaidInvoice(ctx, packageRecord).map(keepInsertResult(insertResult));
}

export function unarchiveAfterNewBookingInvoice(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	insertResult: StripeInvoiceInsertResult
) {
	if (!insertResult.created) {
		return okAsync(insertResult);
	}

	return getSessionFromDb(ctx, bookingId)
		.andThen(unarchiveSessionAndKeepInsertResult(ctx, insertResult))
		.orElse(recoverInsertResult(insertResult));
}

export function unarchiveAfterNewPackageInvoice(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	insertResult: StripeInvoiceInsertResult
) {
	if (!insertResult.created) {
		return okAsync(insertResult);
	}

	return getPackageFromDb(ctx, packageId)
		.andThen(unarchivePackageAndKeepInsertResult(ctx, insertResult))
		.orElse(recoverInsertResult(insertResult));
}

function archiveBookingForPaidStripeInvoice(ctx: MutationCtx, paidAt: number) {
	return (stripeInvoice: Doc<"stripeInvoices"> | null) => {
		if (stripeInvoice?.bookingId !== undefined) {
			return archiveSessionWhenFullyDone(ctx, stripeInvoice.bookingId, paidAt).map(toNull);
		}

		if (stripeInvoice?.packageId !== undefined) {
			return archivePackageWhenFullyDone(ctx, stripeInvoice.packageId, paidAt).map(toNull);
		}

		return okAsync(null);
	};
}

function toNull() {
	return null;
}

export function archiveBookingWhenStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string,
	paidAt: number
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, stripeInvoiceId).andThen(
		archiveBookingForPaidStripeInvoice(ctx, paidAt)
	);
}
