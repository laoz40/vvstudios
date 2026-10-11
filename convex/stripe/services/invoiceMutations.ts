import { stripeInvoiceIdForPaymentArchive } from "#convex/stripe/lib/invoiceArchive";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { StripeInvoiceLineItem } from "#convex/stripe/lib/invoice";
import {
	buildBookingStripeInvoice,
	buildPackageAdjustmentStripeInvoice,
	buildPackageStripeInvoice,
	chooseStripeInvoiceInsertDecision,
	getStripeInvoiceByStripeInvoiceId,
	loadStripeInvoiceDuplicateCandidates,
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage,
	markStripeInvoicePaidWhenPresent,
	writeStripeInvoiceInsertDecision,
	type StripeInvoiceInsert,
	type StripeInvoiceInsertResult,
	type StripeInvoicePaymentClaim
} from "#convex/stripe/lib/invoices";
import { requirePermission } from "#convex/shared/services/auth";
import {
	archiveBookingWhenStripeInvoicePaid,
	unarchiveAfterNewBookingInvoice,
	unarchiveAfterNewPackageInvoice
} from "#convex/stripe/services/invoices";

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

function insertStripeInvoiceIfAbsent(ctx: MutationCtx, invoice: StripeInvoiceInsert) {
	return loadStripeInvoiceDuplicateCandidates(ctx, invoice)
		.map((candidates) => chooseStripeInvoiceInsertDecision(invoice, candidates))
		.andThen((decision) => writeStripeInvoiceInsertDecision(ctx, decision));
}

export function recordBookingStripeInvoice(ctx: MutationCtx, args: RecordBookingStripeInvoiceArgs) {
	return insertStripeInvoiceIfAbsent(ctx, buildBookingStripeInvoice(args));
}

export function recordPackageStripeInvoice(ctx: MutationCtx, args: RecordPackageStripeInvoiceArgs) {
	return insertStripeInvoiceIfAbsent(ctx, buildPackageStripeInvoice(args));
}

export function recordPackageAdjustmentStripeInvoice(
	ctx: MutationCtx,
	args: RecordPackageAdjustmentStripeInvoiceArgs
) {
	return insertStripeInvoiceIfAbsent(ctx, buildPackageAdjustmentStripeInvoice(args));
}

export function markStripeInvoicePaid(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, args.stripeInvoiceId).andThen(
		(stripeInvoice: Doc<"stripeInvoices"> | null) =>
			markStripeInvoicePaidWhenPresent(ctx, args.paidAt, stripeInvoice)
	);
}

export function recordBookingStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordBookingStripeInvoiceArgs
) {
	return recordBookingStripeInvoice(ctx, args).andThen((insertResult: StripeInvoiceInsertResult) =>
		unarchiveAfterNewBookingInvoice(ctx, args.bookingId, insertResult)
	);
}

export function recordPackageStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageStripeInvoiceArgs
) {
	return recordPackageStripeInvoice(ctx, args).andThen((insertResult: StripeInvoiceInsertResult) =>
		unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult)
	);
}

export function recordPackageAdjustmentStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageAdjustmentStripeInvoiceArgs
) {
	return recordPackageAdjustmentStripeInvoice(ctx, args).andThen(
		(insertResult: StripeInvoiceInsertResult) =>
			unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult)
	);
}

export function markStripeInvoicePaidWithArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return markStripeInvoicePaid(ctx, args).andThen((claim: StripeInvoicePaymentClaim) =>
		archiveBookingWhenStripeInvoicePaid(
			ctx,
			stripeInvoiceIdForPaymentArchive(args.stripeInvoiceId, claim),
			args.paidAt
		).map(() => claim)
	);
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
