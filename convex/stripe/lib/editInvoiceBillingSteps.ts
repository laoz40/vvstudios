import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

import {
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage
} from "#convex/stripe/lib/invoices";
import {
	listPackageBookingsForEditInvoice,
	type EditInvoiceTarget
} from "#convex/stripe/lib/editInvoiceDb";
import {
	buildEditInvoiceContext,
	needsCheckoutPayment,
	type BillingRecord
} from "#convex/stripe/lib/editInvoiceBilling";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import {
	parsePackageUpdate,
	validatePackageUpdate,
	type ParsedPackageRequest
} from "#convex/packages/lib/updates";

type BillingSessions = BillingRecord & { bookings: Doc<"bookings">[] };

export function loadBillingSessions(ctx: QueryCtx, billing: BillingRecord) {
	if (!("packageSize" in billing.record)) return okAsync({ ...billing, bookings: [] });

	return listPackageBookingsForEditInvoice(ctx, billing.record._id).map((bookings) => ({
		...billing,
		bookings
	}));
}

export function loadTargetInvoices(ctx: QueryCtx, target: EditInvoiceTarget) {
	if (target.kind === "booking") return listStripeInvoicesForBooking(ctx, target.bookingId);

	return listStripeInvoicesForPackage(ctx, target.packageId);
}

export function billingBookingIds(billing: BillingSessions) {
	return billing.bookings.map((booking) => booking._id);
}

export type BillingWithInvoices = BillingSessions & { invoices: Doc<"stripeInvoices">[] };

export function requireLoadedBillingRecord(
	billing: BillingRecord | null
): Result<BillingRecord, { reason: "BILLING_RECORD_NOT_FOUND" }> {
	return billing === null ? err({ reason: "BILLING_RECORD_NOT_FOUND" }) : ok(billing);
}

export function loadRedirectedBillingRecord(
	ctx: QueryCtx,
	billing: BillingRecord
): ResultAsync<BillingRecord | null, never> {
	const packageId = "packageId" in billing.record ? billing.record.packageId : undefined;

	return packageId === undefined
		? okAsync(billing)
		: okOrThrow(ctx.db.get("packages", packageId)).map((record) =>
				record === null ? null : { target: { kind: "package", packageId }, record }
			);
}

export function billingInvoiceContext(
	billing: BillingWithInvoices,
	next: Parameters<typeof buildEditInvoiceContext>[2]
) {
	return buildEditInvoiceContext(billing, billing.bookings, next, billing.invoices);
}

export function requirePackageBillingRecord(
	record: BillingRecord["record"],
	draft: Extract<EditInvoiceDraft, { kind: "package" }> | null
): Result<Doc<"packages"> | null, { reason: "BILLING_RECORD_NOT_FOUND" }> {
	if (draft === null) return ok(null);

	return "packageSize" in record
		? ok(record)
		: err({ reason: "BILLING_RECORD_NOT_FOUND" as const });
}

export function parseOptionalPackageDraft(
	draft: Extract<EditInvoiceDraft, { kind: "package" }> | null
): Result<ParsedPackageRequest | null, { reason: string }> {
	return draft === null ? ok(null) : parsePackageUpdate(draft.values);
}

export function validateOptionalPackageDraft(
	draft: Extract<EditInvoiceDraft, { kind: "package" }> | null,
	parsed: ParsedPackageRequest | null,
	sessionCount: number
): Result<ParsedPackageRequest | null, { reason: string }> {
	return draft === null || parsed === null
		? ok(null)
		: validatePackageUpdate(draft.values, parsed, sessionCount);
}

export function selectMissingCheckoutPayments<T extends Parameters<typeof needsCheckoutPayment>[0]>(
	records: T[]
) {
	return records.filter(needsCheckoutPayment);
}
