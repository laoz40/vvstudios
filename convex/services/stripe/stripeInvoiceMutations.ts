import { okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { StripeInvoiceLineItem } from "#convex/lib/stripe/stripeInvoice";
import {
	getStripeInvoiceByStripeInvoiceId,
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage,
	patchStripeInvoicePaymentStatus,
	recordBookingStripeInvoice,
	recordPackageAdjustmentStripeInvoice,
	recordPackageStripeInvoice,
	type StripeInvoiceInsertResult,
	type StripeInvoicePaymentClaim
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

function markStripeInvoicePaidWhenPresent(ctx: MutationCtx, paidAt: number) {
	return (stripeInvoice: Doc<"stripeInvoices"> | null) => {
		if (!stripeInvoice) {
			return okAsync({ outcome: "not_found" as const } satisfies StripeInvoicePaymentClaim);
		}

		if (stripeInvoice.paymentStatus === "paid") {
			return okAsync({ outcome: "already_completed" as const } satisfies StripeInvoicePaymentClaim);
		}

		return patchStripeInvoicePaymentStatus(ctx, stripeInvoice._id, paidAt);
	};
}

function unarchiveBookingAfterInsert(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return (insertResult: StripeInvoiceInsertResult) =>
		unarchiveAfterNewBookingInvoice(ctx, bookingId, insertResult);
}

function unarchivePackageAfterInsert(ctx: MutationCtx, packageId: Id<"packages">) {
	return (insertResult: StripeInvoiceInsertResult) =>
		unarchiveAfterNewPackageInvoice(ctx, packageId, insertResult);
}

function keepClaim<T>(claim: T) {
	return () => claim;
}

function archiveBookingAfterStripeInvoicePaid(
	ctx: MutationCtx,
	stripeInvoiceId: string,
	paidAt: number
) {
	return (claim: StripeInvoicePaymentClaim) => {
		if (claim.outcome === "not_found") {
			return okAsync(claim);
		}

		return archiveBookingWhenStripeInvoicePaid(ctx, stripeInvoiceId, paidAt).map(keepClaim(claim));
	};
}

function listBookingStripeInvoices(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return () => listStripeInvoicesForBooking(ctx, bookingId);
}

function listPackageStripeInvoices(ctx: QueryCtx, packageId: Id<"packages">) {
	return () => listStripeInvoicesForPackage(ctx, packageId);
}

export function markStripeInvoicePaid(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return getStripeInvoiceByStripeInvoiceId(ctx, args.stripeInvoiceId).andThen(
		markStripeInvoicePaidWhenPresent(ctx, args.paidAt)
	);
}

export function recordBookingStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordBookingStripeInvoiceArgs
) {
	return recordBookingStripeInvoice(ctx, args).andThen(
		unarchiveBookingAfterInsert(ctx, args.bookingId)
	);
}

export function recordPackageStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageStripeInvoiceArgs
) {
	return recordPackageStripeInvoice(ctx, args).andThen(
		unarchivePackageAfterInsert(ctx, args.packageId)
	);
}

export function recordPackageAdjustmentStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageAdjustmentStripeInvoiceArgs
) {
	return recordPackageAdjustmentStripeInvoice(ctx, args).andThen(
		unarchivePackageAfterInsert(ctx, args.packageId)
	);
}

export function markStripeInvoicePaidWithArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return markStripeInvoicePaid(ctx, args).andThen(
		archiveBookingAfterStripeInvoicePaid(ctx, args.stripeInvoiceId, args.paidAt)
	);
}

export function listBookingStripeInvoicesForAdmin(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(
		listBookingStripeInvoices(ctx, bookingId)
	);
}

export function listPackageStripeInvoicesForAdmin(ctx: QueryCtx, packageId: Id<"packages">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(
		listPackageStripeInvoices(ctx, packageId)
	);
}
