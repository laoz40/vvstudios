import {
	loadBookingForNewInvoice,
	loadPackageForNewInvoice,
	invoiceArchiveTargets
} from "#convex/stripe/lib/invoiceArchive";
import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const booking = yield* loadBookingForNewInvoice(ctx, bookingId, insertResult);
		yield* unarchiveSessionForNewUnpaidInvoice(ctx, booking);

		return ok(insertResult);
	}).orElse(() => ok(insertResult));
}

export function unarchiveAfterNewPackageInvoice(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	insertResult: StripeInvoiceInsertResult
) {
	return safeTry(async function* () {
		const packageRecord = yield* loadPackageForNewInvoice(ctx, packageId, insertResult);
		yield* unarchivePackageForNewUnpaidInvoice(ctx, packageRecord);

		return ok(insertResult);
	}).orElse(() => ok(insertResult));
}

export function archiveBookingWhenStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string | null,
	paidAt: number
) {
	return safeTry(async function* () {
		const invoice = yield* getStripeInvoiceByStripeInvoiceId(ctx, stripeInvoiceId);
		const targets = invoiceArchiveTargets(invoice);
		yield* archiveSessionWhenFullyDone(ctx, targets.bookingId, paidAt);
		const archivedPackage = yield* archivePackageWhenFullyDone(ctx, targets.packageId, paidAt);

		return ok(archivedPackage);
	});
}
