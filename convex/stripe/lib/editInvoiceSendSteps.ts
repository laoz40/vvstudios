"use node";

import { err, ok, okAsync, type Result } from "neverthrow";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { api, internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import type { syncAdminBookingGoogleCalendarAndDb } from "#convex/googleCalendar/services/adminUpdate";
import type { AdminSessionUpdateResult } from "#convex/sessions/lib/adminEdit";

type PaymentRecord = Doc<"bookings"> | Doc<"packages">;

type BookingDraft = Extract<EditInvoiceDraft, { kind: "booking" }>;

export type SessionEditContext = Omit<
	Parameters<typeof syncAdminBookingGoogleCalendarAndDb>[0],
	"ctx" | "args"
>;

export type CachePaymentResult = { id: string; reason: string | null };

export function quoteRecipientCustomerId(
	needsCustomerEmail: true,
	stripeCustomerId: string | undefined
): Result<string, { reason: "STRIPE_CUSTOMER_NOT_FOUND" }>;
export function quoteRecipientCustomerId(
	needsCustomerEmail: boolean,
	stripeCustomerId: string | undefined
): Result<string | null, { reason: "STRIPE_CUSTOMER_NOT_FOUND" }>;
export function quoteRecipientCustomerId(
	needsCustomerEmail: boolean,
	stripeCustomerId: string | undefined
): Result<string | null, { reason: "STRIPE_CUSTOMER_NOT_FOUND" }> {
	if (!needsCustomerEmail) return ok(null);

	return stripeCustomerId ? ok(stripeCustomerId) : err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" });
}

export function cacheOriginalPaymentMutation(
	ctx: ActionCtx,
	record: PaymentRecord,
	stripeSessionId: string | null,
	amount: number | null
) {
	if (stripeSessionId === null || amount === null) return okAsync(null);

	const target: EditInvoiceTarget =
		"packageSize" in record
			? { kind: "package", packageId: record._id }
			: { kind: "booking", bookingId: record._id };

	return fromConvexTuple(
		ctx.runMutation(internal.stripe.editInvoices.cacheOriginalPayment, {
			target,
			amount,
			stripeSessionId
		})
	);
}

export function invoiceDraftTimingArgs(
	draft: BookingDraft,
	{ session, client, settings }: SessionEditContext
) {
	return {
		bypassAvailabilitySettings: session.status !== "failed",
		calendar: client.calendar,
		calendarIds: client.calendarIds,
		existing: session,
		next: draft.values,
		settings,
		timeZone: client.timeZone
	};
}

export function savePackageEditDraft(
	ctx: ActionCtx,
	draft: Extract<EditInvoiceDraft, { kind: "package" }>
) {
	return fromConvexTuple(
		ctx.runMutation(api.packages.admin.updatePackageFromAdmin, draft.values)
	).map((): AdminSessionUpdateResult => ({}));
}

export function loadInvoiceContext(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
) {
	return fromConvexTuple(ctx.runQuery(internal.stripe.editInvoices.getContext, args));
}
