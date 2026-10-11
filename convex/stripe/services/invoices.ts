import {
	loadBookingForNewInvoice,
	loadPackageForNewInvoice,
	invoiceArchiveTargets
} from "#convex/stripe/lib/invoiceArchive";
import { ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { unarchivePackageForNewUnpaidInvoice } from "#convex/packages/lib/archive";
import { archivePackageWhenFullyDone } from "#convex/packages/services/archive";
import {
	getStripeInvoiceByStripeInvoiceId,
	type StripeInvoiceInsertResult
} from "#convex/stripe/lib/invoices";
import { unarchiveSessionForNewUnpaidInvoice } from "#convex/sessions/lib/archive";
import { archiveSessionWhenFullyDone } from "#convex/sessions/services/archive";

export function unarchiveAfterNewBookingInvoice(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	insertResult: StripeInvoiceInsertResult
) {
	return loadBookingForNewInvoice(ctx, bookingId, insertResult)
		.andThen((session) => unarchiveSessionForNewUnpaidInvoice(ctx, session))
		.map(() => insertResult)
		.orElse(() => ok(insertResult));
}

export function unarchiveAfterNewPackageInvoice(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	insertResult: StripeInvoiceInsertResult
) {
	return loadPackageForNewInvoice(ctx, packageId, insertResult)
		.andThen((packageRecord) => unarchivePackageForNewUnpaidInvoice(ctx, packageRecord))
		.map(() => insertResult)
		.orElse(() => ok(insertResult));
}

export function archiveBookingWhenStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string | null,
	paidAt: number
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, stripeInvoiceId)
		.map(invoiceArchiveTargets)
		.andThen((targets) =>
			archiveSessionWhenFullyDone(ctx, targets.bookingId, paidAt).map(() => targets)
		)
		.andThen((targets) => archivePackageWhenFullyDone(ctx, targets.packageId, paidAt));
}
