import { ok, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { unarchivePackageForNewUnpaidInvoice } from "#convex/lib/packages/packageArchive";
import { archivePackageWhenFullyDone } from "#convex/services/packages/packageArchive";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import { getStripeInvoiceByStripeInvoiceId } from "#convex/lib/stripe/stripeInvoices";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
import { unarchiveSessionForNewUnpaidInvoice } from "#convex/lib/sessions/sessionArchive";
import { archiveSessionWhenFullyDone } from "#convex/services/sessions/sessionArchive";
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
