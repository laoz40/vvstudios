import { ok, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	archivePackageWhenFullyDone,
	unarchivePackageForNewUnpaidInvoice
} from "#convex/lib/packages/packageArchive";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
import { getStripeInvoiceByStripeInvoiceId } from "#convex/lib/stripe/stripeInvoices";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	archiveSessionWhenFullyDone,
	unarchiveSessionForNewUnpaidInvoice
} from "#convex/lib/sessions/sessionArchive";
import { type StripeInvoiceInsertResult } from "#convex/lib/stripe/stripeInvoices";

export function unarchiveAfterNewBookingInvoice(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	insertResult: StripeInvoiceInsertResult
) {
	if (!insertResult.created) {
		return okAsync(insertResult);
	}

	return getSessionFromDb(ctx, bookingId)
		.andThen((session) => unarchiveSessionForNewUnpaidInvoice(ctx, session).map(() => insertResult))
		.orElse(() => ok(insertResult));
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
		.andThen((packageRecord) =>
			unarchivePackageForNewUnpaidInvoice(ctx, packageRecord).map(() => insertResult)
		)
		.orElse(() => ok(insertResult));
}

export function archiveBookingWhenStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string,
	paidAt: number
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, stripeInvoiceId).andThen((stripeInvoice) => {
		if (stripeInvoice?.bookingId !== undefined) {
			return archiveSessionWhenFullyDone(ctx, stripeInvoice.bookingId, paidAt).map(() => null);
		}

		if (stripeInvoice?.packageId !== undefined) {
			return archivePackageWhenFullyDone(ctx, stripeInvoice.packageId, paidAt).map(() => null);
		}

		return okAsync(null);
	});
}
