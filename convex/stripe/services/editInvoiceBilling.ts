import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx, MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import {
	listStripeInvoicesForBookings,
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage
} from "#convex/stripe/lib/invoices";
import {
	loadEditInvoiceRecord,
	listCheckoutPaymentPage,
	cacheOriginalPaymentIfMissing,
	listPackageBookingsForEditInvoice,
	type EditInvoiceTarget
} from "#convex/stripe/lib/editInvoiceDb";
import {
	applyEditInvoiceDraft,
	buildEditInvoiceContext,
	needsCheckoutPayment,
	type BillingRecord,
	type EditInvoiceContext
} from "#convex/stripe/lib/editInvoiceBilling";
import type { EditInvoiceDraft } from "#convex/stripe/services/editInvoiceValidators";

export function loadMissingCheckoutPayments(
	ctx: QueryCtx,
	args: { table: "bookings" | "packages"; cursor: string | null }
) {
	return listCheckoutPaymentPage(ctx, args.table, args.cursor).map((page) => ({
		...page,
		page: page.page.filter(needsCheckoutPayment)
	}));
}

export function saveOriginalPaidAmount(
	ctx: MutationCtx,
	args: { target: EditInvoiceTarget; amount: number; stripeSessionId: string }
) {
	return loadEditInvoiceRecord(ctx, args.target).andThen((record) =>
		cacheOriginalPaymentIfMissing(ctx, record, args)
	);
}

function resolveBillingRecord(
	ctx: QueryCtx,
	target: EditInvoiceTarget,
	record: BillingRecord["record"] | null
): ResultAsync<BillingRecord, { reason: string }> {
	if (!record) return errAsync({ reason: "BILLING_RECORD_NOT_FOUND" });

	if ("packageId" in record && record.packageId) {
		const packageTarget = { kind: "package" as const, packageId: record.packageId };

		return loadEditInvoiceRecord(ctx, packageTarget).andThen((pkg) =>
			resolveBillingRecord(ctx, packageTarget, pkg)
		);
	}

	return okAsync({ target, record });
}

type BillingSessions = BillingRecord & { bookings: Doc<"bookings">[] };

function loadBillingSessions(ctx: QueryCtx, billing: BillingRecord) {
	if (!("packageSize" in billing.record)) return okAsync({ ...billing, bookings: [] });

	return listPackageBookingsForEditInvoice(ctx, billing.record._id).map((bookings) => ({
		...billing,
		bookings
	}));
}

function loadTargetInvoices(ctx: QueryCtx, target: EditInvoiceTarget) {
	if (target.kind === "booking") return listStripeInvoicesForBooking(ctx, target.bookingId);

	return listStripeInvoicesForPackage(ctx, target.packageId);
}

function loadBillingInvoices(ctx: QueryCtx, billing: BillingSessions) {
	const bookingIds = billing.bookings.map((booking) => booking._id);

	return ResultAsync.combine([
		loadTargetInvoices(ctx, billing.target),
		listStripeInvoicesForBookings(ctx, bookingIds)
	]).map(([invoices, sessionInvoices]) => ({
		...billing,
		invoices: [...invoices, ...sessionInvoices]
	}));
}

function quoteDraftChanges(
	billing: BillingSessions & { invoices: Doc<"stripeInvoices">[] },
	draft: EditInvoiceDraft | undefined
) {
	return applyEditInvoiceDraft(
		billing.record,
		billing.bookings,
		draft,
		env.GOOGLE_CALENDAR_TIMEZONE
	).map((next) => buildEditInvoiceContext(billing, billing.bookings, next, billing.invoices));
}

export function loadEditInvoiceContext(
	ctx: QueryCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
): ResultAsync<EditInvoiceContext, { reason: string }> {
	return loadEditInvoiceRecord(ctx, args.target)
		.andThen((record) => resolveBillingRecord(ctx, args.target, record))
		.andThen((billing) => loadBillingSessions(ctx, billing))
		.andThen((billing) => loadBillingInvoices(ctx, billing))
		.andThen((billing) => quoteDraftChanges(billing, args.draft));
}
