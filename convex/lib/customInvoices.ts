import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type CustomInvoiceInsert = Omit<
	Doc<"customInvoices">,
	"_id" | "_creationTime" | "invoiceNumber" | "createdAt"
>;

export function getSelectedBookingCustomInvoice(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	customInvoiceId?: Id<"customInvoices">
): ResultAsync<Doc<"customInvoices"> | null | undefined, never> {
	if (customInvoiceId === undefined) {
		return okAsync(undefined);
	}

	return okOrThrow(
		ctx.runQuery(internal.customInvoices.getBookingCustomInvoiceSource, {
			bookingId,
			customInvoiceId
		})
	);
}

export function validateCustomTotalDueAmount(amount: number | undefined) {
	if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
		return err({ reason: "INVALID_CUSTOM_TOTAL_DUE_AMOUNT" as const });
	}

	return ok(null);
}

export function saveNumberedCustomInvoice(ctx: MutationCtx, invoice: CustomInvoiceInsert) {
	return okOrThrow(
		(async () => {
			const createdAt = Date.now();
			const customInvoiceId = await ctx.db.insert("customInvoices", {
				...invoice,
				invoiceNumber: "pending",
				createdAt
			});
			const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

			await ctx.db.patch(customInvoiceId, { invoiceNumber });

			return { customInvoiceId, invoiceNumber, createdAt };
		})()
	);
}
