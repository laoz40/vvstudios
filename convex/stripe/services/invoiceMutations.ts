import { ok, safeTry } from "neverthrow";
import { stripeInvoiceIdForPaymentArchive } from "#convex/stripe/lib/invoiceArchive";
import type { Id } from "#convex/_generated/dataModel";
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
	type StripeInvoiceInsert
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
	return safeTry(async function* () {
		const duplicateCandidates = yield* loadStripeInvoiceDuplicateCandidates(ctx, invoice);
		const insertDecision = chooseStripeInvoiceInsertDecision(invoice, duplicateCandidates);
		const inserted = yield* writeStripeInvoiceInsertDecision(ctx, insertDecision);

		return ok(inserted);
	});
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
	return safeTry(async function* () {
		const invoice = yield* getStripeInvoiceByStripeInvoiceId(ctx, args.stripeInvoiceId);
		const claim = yield* markStripeInvoicePaidWhenPresent(ctx, args.paidAt, invoice);

		return ok(claim);
	});
}

export function recordBookingStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordBookingStripeInvoiceArgs
) {
	return safeTry(async function* () {
		const insertResult = yield* recordBookingStripeInvoice(ctx, args);
		const updated = yield* unarchiveAfterNewBookingInvoice(ctx, args.bookingId, insertResult);

		return ok(updated);
	});
}

export function recordPackageStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageStripeInvoiceArgs
) {
	return safeTry(async function* () {
		const insertResult = yield* recordPackageStripeInvoice(ctx, args);
		const updated = yield* unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult);

		return ok(updated);
	});
}

export function recordPackageAdjustmentStripeInvoiceWithUnarchive(
	ctx: MutationCtx,
	args: RecordPackageAdjustmentStripeInvoiceArgs
) {
	return safeTry(async function* () {
		const insertResult = yield* recordPackageAdjustmentStripeInvoice(ctx, args);
		const updated = yield* unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult);

		return ok(updated);
	});
}

export function markStripeInvoicePaidWithArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return safeTry(async function* () {
		const claim = yield* markStripeInvoicePaid(ctx, args);
		yield* archiveBookingWhenStripeInvoicePaid(
			ctx,
			stripeInvoiceIdForPaymentArchive(args.stripeInvoiceId, claim),
			args.paidAt
		);

		return ok(claim);
	});
}

export function listBookingStripeInvoicesForAdmin(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "view:sensitive-booking-data");
		const invoices = yield* listStripeInvoicesForBooking(ctx, bookingId);

		return ok(invoices);
	});
}

export function listPackageStripeInvoicesForAdmin(ctx: QueryCtx, packageId: Id<"packages">) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "view:sensitive-booking-data");
		const invoices = yield* listStripeInvoicesForPackage(ctx, packageId);

		return ok(invoices);
	});
}
