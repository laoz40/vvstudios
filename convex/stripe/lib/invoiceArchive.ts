import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { lookupPackageRow } from "#convex/packages/lib/lookup";
import { getBookingRow } from "#convex/sessions/lib/lookup";
import type {
	StripeInvoiceInsertResult,
	StripeInvoicePaymentClaim
} from "#convex/stripe/lib/invoices";

export function loadBookingForNewInvoice(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	insertResult: StripeInvoiceInsertResult
): ResultAsync<Doc<"bookings"> | null, never> {
	if (!insertResult.created) return okAsync(null);

	return getBookingRow(ctx, bookingId);
}

export function loadPackageForNewInvoice(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	insertResult: StripeInvoiceInsertResult
): ResultAsync<Doc<"packages"> | null, never> {
	if (!insertResult.created) return okAsync(null);

	return lookupPackageRow(ctx, packageId);
}

export function invoiceArchiveTargets(invoice: Doc<"stripeInvoices"> | null) {
	return {
		bookingId: invoice?.bookingId ?? null,
		packageId: invoice?.bookingId === undefined ? (invoice?.packageId ?? null) : null
	};
}

export function stripeInvoiceIdForPaymentArchive(
	stripeInvoiceId: string,
	claim: StripeInvoicePaymentClaim
) {
	return claim.outcome === "not_found" ? null : stripeInvoiceId;
}
