import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { StripeInvoiceLineItem } from "#convex/lib/stripe/stripeInvoice";
import {
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage,
	markStripeInvoicePaid,
	recordBookingStripeInvoice,
	recordPackageAdjustmentStripeInvoice,
	recordPackageStripeInvoice
} from "#convex/lib/stripe/stripeInvoices";
import { requirePermission } from "#convex/services/auth";
import {
	archiveBookingWhenStripeInvoicePaid,
	unarchiveAfterNewBookingInvoice,
	unarchiveAfterNewPackageInvoice
} from "#convex/services/stripe/stripeInvoices";

type RecordBookingStripeInvoiceArgs = {
	bookingId: Id<"bookings">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	requestId: string;
	createdBy?: string;
};

type RecordPackageStripeInvoiceArgs = {
	packageId: Id<"packages">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	requestId: string;
	createdBy?: string;
};

type RecordPackageAdjustmentStripeInvoiceArgs = {
	packageId: Id<"packages">;
	packageAdjustmentId: Id<"packageAdjustments">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	totalAmount: number;
};

export function recordBookingStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordBookingStripeInvoiceArgs
) {
	return recordBookingStripeInvoice(ctx, args).andThen((insertResult) =>
		unarchiveAfterNewBookingInvoice(ctx, args.bookingId, insertResult)
	);
}

export function recordPackageStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageStripeInvoiceArgs
) {
	return recordPackageStripeInvoice(ctx, args).andThen((insertResult) =>
		unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult)
	);
}

export function recordPackageAdjustmentStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageAdjustmentStripeInvoiceArgs
) {
	return recordPackageAdjustmentStripeInvoice(ctx, args).andThen((insertResult) =>
		unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult)
	);
}

export function markStripeInvoicePaidWithArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return markStripeInvoicePaid(ctx, args).andThen((claim) => {
		if (claim.outcome === "not_found") {
			return okAsync(claim);
		}

		return archiveBookingWhenStripeInvoicePaid(ctx, args.stripeInvoiceId, args.paidAt).map(
			() => claim
		);
	});
}

export function listBookingStripeInvoicesForAdmin(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listStripeInvoicesForBooking(ctx, bookingId)
	);
}

export function listPackageStripeInvoicesForAdmin(ctx: QueryCtx, packageId: Id<"packages">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listStripeInvoicesForPackage(ctx, packageId)
	);
}
