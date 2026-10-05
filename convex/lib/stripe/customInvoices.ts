import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

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

	return okOrThrow<Doc<"customInvoices"> | null>(
		ctx.runQuery(internal.customInvoices.getBookingCustomInvoiceInput, {
			bookingId,
			customInvoiceId
		})
	);
}

export function listCustomInvoicesByBookingId(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("customInvoices")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.order("desc")
			.collect()
	);
}

export function getCustomInvoiceRow(
	ctx: QueryCtx | MutationCtx,
	customInvoiceId: Id<"customInvoices">
) {
	return okOrThrow(ctx.db.get("customInvoices", customInvoiceId));
}

export function validateCustomTotalDueAmount(amount: number | undefined) {
	if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
		return err({ reason: "INVALID_CUSTOM_TOTAL_DUE_AMOUNT" as const });
	}

	return ok(null);
}

export function insertPendingCustomInvoice(ctx: MutationCtx, invoice: CustomInvoiceInsert) {
	const createdAt = Date.now();

	return okOrThrow(
		ctx.db.insert("customInvoices", { ...invoice, invoiceNumber: "pending", createdAt })
	).map((customInvoiceId) => ({ customInvoiceId, createdAt }));
}

export function patchCustomInvoiceNumber(
	ctx: MutationCtx,
	customInvoiceId: Id<"customInvoices">,
	invoiceNumber: string
) {
	return okOrThrow(
		ctx.db.patch("customInvoices", customInvoiceId, { invoiceNumber }).then(() => null)
	);
}
