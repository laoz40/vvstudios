import { ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { unarchivePackageForNewUnpaidInvoice } from "#convex/packages/lib/archive";
import { archivePackageWhenFullyDone } from "#convex/packages/services/archive";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import { getStripeInvoiceByStripeInvoiceId } from "#convex/stripe/lib/invoices";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import { unarchiveSessionForNewUnpaidInvoice } from "#convex/sessions/lib/archive";
import { archiveSessionWhenFullyDone } from "#convex/sessions/services/archive";
import { type StripeInvoiceInsertResult } from "#convex/stripe/lib/invoices";

function keepInsertResult<T>(insertResult: T) {
	return insertResult;
}

function recoverInsertResult<T>(insertResult: T) {
	return ok(insertResult);
}

function unarchiveSessionAndKeepInsertResult(
	ctx: MutationCtx,
	insertResult: StripeInvoiceInsertResult,

	session: Doc<"bookings">
) {
	return unarchiveSessionForNewUnpaidInvoice(ctx, session).map(() =>
		keepInsertResult(insertResult)
	);
}

function unarchivePackageAndKeepInsertResult(
	ctx: MutationCtx,
	insertResult: StripeInvoiceInsertResult,

	packageRecord: Doc<"packages">
) {
	return unarchivePackageForNewUnpaidInvoice(ctx, packageRecord).map(() =>
		keepInsertResult(insertResult)
	);
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
		.andThen((session: Doc<"bookings">) =>
			unarchiveSessionAndKeepInsertResult(ctx, insertResult, session)
		)
		.orElse(() => recoverInsertResult(insertResult));
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
		.andThen((packageRecord: Doc<"packages">) =>
			unarchivePackageAndKeepInsertResult(ctx, insertResult, packageRecord)
		)
		.orElse(() => recoverInsertResult(insertResult));
}

function archiveBookingForPaidStripeInvoice(
	ctx: MutationCtx,
	paidAt: number,
	stripeInvoice: Doc<"stripeInvoices"> | null
) {
	if (stripeInvoice?.bookingId !== undefined) {
		return archiveSessionWhenFullyDone(ctx, stripeInvoice.bookingId, paidAt).map(() => null);
	}

	if (stripeInvoice?.packageId !== undefined) {
		return archivePackageWhenFullyDone(ctx, stripeInvoice.packageId, paidAt).map(() => null);
	}

	return okAsync(null);
}

export function archiveBookingWhenStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string,
	paidAt: number
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, stripeInvoiceId).andThen(
		(stripeInvoice: Doc<"stripeInvoices"> | null) =>
			archiveBookingForPaidStripeInvoice(ctx, paidAt, stripeInvoice)
	);
}
