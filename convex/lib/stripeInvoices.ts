import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type { StripeInvoiceLineItem } from "#convex/lib/stripeInvoice";

export type StripeInvoiceKind = Doc<"stripeInvoices">["kind"];

export type StripeInvoiceAmountSummary = {
	paymentStatus: Doc<"stripeInvoices">["paymentStatus"];
	totalAmount: number;
};

export type StripeInvoicePaymentClaim =
	| { outcome: "already_completed" }
	| { outcome: "completed" }
	| { outcome: "not_found" };

type StripeInvoiceInsert = Omit<Doc<"stripeInvoices">, "_id" | "_creationTime">;

function sumStripeInvoiceLineItems(lineItems: StripeInvoiceLineItem[]) {
	return lineItems.reduce((total, lineItem) => total + lineItem.amount, 0);
}

export function summarizeStripeInvoices(
	invoices: Doc<"stripeInvoices">[]
): StripeInvoiceAmountSummary | null {
	if (invoices.length === 0) {
		return null;
	}

	const totalAmount = invoices.reduce((total, invoice) => total + invoice.totalAmount, 0);

	const paymentStatus = invoices.some((invoice) => invoice.paymentStatus === "unpaid")
		? "unpaid"
		: "paid";

	return { paymentStatus, totalAmount };
}

export function summarizeCustomPackageStripeInvoices(
	invoices: Doc<"stripeInvoices">[]
): StripeInvoiceAmountSummary | null {
	const customInvoices = invoices.filter((invoice) => invoice.kind !== "package_adjustment");

	return summarizeStripeInvoices(customInvoices);
}

function getStripeInvoiceByStripeInvoiceId(ctx: QueryCtx | MutationCtx, stripeInvoiceId: string) {
	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_stripeInvoiceId", (indexQuery) =>
				indexQuery.eq("stripeInvoiceId", stripeInvoiceId)
			)
			.unique()
	);
}

// Idempotent insert: on retry, return the existing row instead of inserting again.
function insertStripeInvoiceIfAbsent(ctx: MutationCtx, invoice: StripeInvoiceInsert) {
	return okOrThrow(
		(async () => {
			const existingByStripeInvoiceId = await ctx.db
				.query("stripeInvoices")
				.withIndex("by_stripeInvoiceId", (indexQuery) =>
					indexQuery.eq("stripeInvoiceId", invoice.stripeInvoiceId)
				)
				.unique();

			if (existingByStripeInvoiceId) {
				return { stripeInvoiceRecordId: existingByStripeInvoiceId._id, created: false };
			}

			if (invoice.requestId) {
				const existingByRequestId = await ctx.db
					.query("stripeInvoices")
					.withIndex("by_requestId", (indexQuery) => indexQuery.eq("requestId", invoice.requestId))
					.unique();

				if (existingByRequestId) {
					return { stripeInvoiceRecordId: existingByRequestId._id, created: false };
				}
			}

			if (invoice.packageAdjustmentId) {
				const existingByAdjustmentId = await ctx.db
					.query("stripeInvoices")
					.withIndex("by_packageAdjustmentId", (indexQuery) =>
						indexQuery.eq("packageAdjustmentId", invoice.packageAdjustmentId)
					)
					.unique();

				if (existingByAdjustmentId) {
					return { stripeInvoiceRecordId: existingByAdjustmentId._id, created: false };
				}
			}

			const stripeInvoiceRecordId = await ctx.db.insert("stripeInvoices", invoice);

			return { stripeInvoiceRecordId, created: true };
		})()
	);
}

export function recordBookingStripeInvoice(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		createdBy?: string;
	}
) {
	const createdAt = Date.now();

	return insertStripeInvoiceIfAbsent(ctx, {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "booking",
		bookingId: args.bookingId,
		lineItems: args.lineItems,
		totalAmount: sumStripeInvoiceLineItems(args.lineItems),
		paymentStatus: "unpaid",
		createdAt,
		requestId: args.requestId,
		createdBy: args.createdBy
	});
}

export function recordPackageStripeInvoice(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		createdBy?: string;
	}
) {
	const createdAt = Date.now();

	return insertStripeInvoiceIfAbsent(ctx, {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "package",
		packageId: args.packageId,
		lineItems: args.lineItems,
		totalAmount: sumStripeInvoiceLineItems(args.lineItems),
		paymentStatus: "unpaid",
		createdAt,
		requestId: args.requestId,
		createdBy: args.createdBy
	});
}

export function recordPackageAdjustmentStripeInvoice(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		packageAdjustmentId: Id<"packageAdjustments">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		totalAmount: number;
	}
) {
	const createdAt = Date.now();

	return insertStripeInvoiceIfAbsent(ctx, {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "package_adjustment",
		packageId: args.packageId,
		packageAdjustmentId: args.packageAdjustmentId,
		lineItems: args.lineItems,
		totalAmount: args.totalAmount,
		paymentStatus: "unpaid",
		createdAt
	});
}

export function markStripeInvoicePaid(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
): ResultAsync<StripeInvoicePaymentClaim, never> {
	return getStripeInvoiceByStripeInvoiceId(ctx, args.stripeInvoiceId).andThen((stripeInvoice) => {
		if (!stripeInvoice) {
			return okAsync({ outcome: "not_found" as const });
		}

		if (stripeInvoice.paymentStatus === "paid") {
			return okAsync({ outcome: "already_completed" as const });
		}

		return okOrThrow(
			ctx.db
				.patch(stripeInvoice._id, { paymentStatus: "paid", paidAt: args.paidAt })
				.then(() => ({ outcome: "completed" as const }))
		);
	});
}

export function listStripeInvoicesForBooking(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_bookingId", (indexQuery) => indexQuery.eq("bookingId", bookingId))
			.order("desc")
			.collect()
	);
}

export function listStripeInvoicesForPackage(ctx: QueryCtx, packageId: Id<"packages">) {
	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageId))
			.order("desc")
			.collect()
	);
}
