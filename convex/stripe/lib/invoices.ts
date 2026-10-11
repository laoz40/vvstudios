import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import type { StripeInvoiceLineItem } from "#convex/stripe/lib/invoice";

export type StripeInvoiceKind = Doc<"stripeInvoices">["kind"];

export type StripeInvoiceAmountSummary = {
	paymentStatus: Doc<"stripeInvoices">["paymentStatus"];
	totalAmount: number;
};

export type StripeInvoicePaymentClaim =
	| { outcome: "already_completed" }
	| { outcome: "completed" }
	| { outcome: "not_found" };

export type StripeInvoiceInsert = Omit<Doc<"stripeInvoices">, "_id" | "_creationTime">;

export type StripeInvoiceInsertResult = {
	stripeInvoiceRecordId: Id<"stripeInvoices">;
	created: boolean;
};

export type StripeInvoiceDuplicateCandidates = {
	stripeInvoice: Doc<"stripeInvoices"> | null;
	request: Doc<"stripeInvoices"> | null;
	adjustment: Doc<"stripeInvoices"> | null;
};

export type StripeInvoiceInsertDecision =
	| { kind: "existing"; stripeInvoiceRecordId: Id<"stripeInvoices"> }
	| { kind: "insert"; invoice: StripeInvoiceInsert };

function sumStripeInvoiceLineItems(lineItems: StripeInvoiceLineItem[]) {
	return lineItems.reduce((total, lineItem) => total + lineItem.amount, 0);
}

export function calculatePaidAmount({
	originalPaidAmount,
	invoices,
	paidRemainingBalanceAmount = 0
}: {
	originalPaidAmount: number | null;
	invoices: Doc<"stripeInvoices">[];
	paidRemainingBalanceAmount?: number;
}) {
	if (originalPaidAmount === null) return null;

	const paidInvoices = invoices.reduce(
		(total, invoice) => total + (invoice.paymentStatus === "paid" ? invoice.totalAmount : 0),
		0
	);

	return Math.round((originalPaidAmount + paidInvoices + paidRemainingBalanceAmount) * 100) / 100;
}

export function listStripeInvoicesForBookings(
	ctx: QueryCtx | MutationCtx,
	bookingIds: Id<"bookings">[]
) {
	return ResultAsync.combine(
		bookingIds.map((bookingId) => listStripeInvoicesForBooking(ctx, bookingId))
	).map((groups) => groups.flat());
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

export function getStripeInvoiceByStripeInvoiceId(
	ctx: QueryCtx | MutationCtx,
	stripeInvoiceId: string | null
) {
	if (stripeInvoiceId === null) return okAsync<Doc<"stripeInvoices"> | null>(null);

	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_stripeInvoiceId", (indexQuery) =>
				indexQuery.eq("stripeInvoiceId", stripeInvoiceId)
			)
			.unique()
	);
}

export function insertStripeInvoiceRecord(
	ctx: MutationCtx,
	invoice: StripeInvoiceInsert
): ResultAsync<StripeInvoiceInsertResult, never> {
	return okOrThrow(ctx.db.insert("stripeInvoices", invoice)).map((stripeInvoiceRecordId) => ({
		stripeInvoiceRecordId,
		created: true
	}));
}

export function lookupStripeInvoiceByPackageAdjustmentId(
	ctx: MutationCtx,
	packageAdjustmentId: Id<"packageAdjustments">
) {
	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_packageAdjustmentId", (indexQuery) =>
				indexQuery.eq("packageAdjustmentId", packageAdjustmentId)
			)
			.unique()
	);
}

export function lookupStripeInvoiceByRequestId(ctx: MutationCtx, requestId: string) {
	return okOrThrow(
		ctx.db
			.query("stripeInvoices")
			.withIndex("by_requestId", (indexQuery) => indexQuery.eq("requestId", requestId))
			.unique()
	);
}

export function loadStripeInvoiceDuplicateCandidates(
	ctx: MutationCtx,
	invoice: StripeInvoiceInsert
) {
	const requestLookup = invoice.requestId
		? lookupStripeInvoiceByRequestId(ctx, invoice.requestId)
		: okAsync(null);

	const adjustmentLookup = invoice.packageAdjustmentId
		? lookupStripeInvoiceByPackageAdjustmentId(ctx, invoice.packageAdjustmentId)
		: okAsync(null);

	return ResultAsync.combine([
		getStripeInvoiceByStripeInvoiceId(ctx, invoice.stripeInvoiceId),
		requestLookup,
		adjustmentLookup
	]).map(([stripeInvoice, request, adjustment]) => ({ stripeInvoice, request, adjustment }));
}

export function chooseStripeInvoiceInsertDecision(
	invoice: StripeInvoiceInsert,
	candidates: StripeInvoiceDuplicateCandidates
): StripeInvoiceInsertDecision {
	const existing = candidates.stripeInvoice ?? candidates.request ?? candidates.adjustment;

	return existing
		? { kind: "existing", stripeInvoiceRecordId: existing._id }
		: { kind: "insert", invoice };
}

export function writeStripeInvoiceInsertDecision(
	ctx: MutationCtx,
	decision: StripeInvoiceInsertDecision
) {
	return decision.kind === "existing"
		? okAsync({ stripeInvoiceRecordId: decision.stripeInvoiceRecordId, created: false })
		: insertStripeInvoiceRecord(ctx, decision.invoice);
}

export function markStripeInvoicePaidWhenPresent(
	ctx: MutationCtx,
	paidAt: number,
	stripeInvoice: Doc<"stripeInvoices"> | null
) {
	if (!stripeInvoice) {
		return okAsync({ outcome: "not_found" as const } satisfies StripeInvoicePaymentClaim);
	}

	if (stripeInvoice.paymentStatus === "paid") {
		return okAsync({ outcome: "already_completed" as const } satisfies StripeInvoicePaymentClaim);
	}

	return patchStripeInvoicePaymentStatus(ctx, stripeInvoice._id, paidAt);
}

export function buildBookingStripeInvoice(args: {
	bookingId: Id<"bookings">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	requestId: string;
	createdBy?: string;
}): StripeInvoiceInsert {
	const createdAt = Date.now();

	return {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "booking",
		bookingId: args.bookingId,
		lineItems: args.lineItems,
		totalAmount: sumStripeInvoiceLineItems(args.lineItems),
		paymentStatus: "unpaid",
		createdAt,
		requestId: args.requestId,
		createdBy: args.createdBy
	};
}

export function buildPackageStripeInvoice(args: {
	packageId: Id<"packages">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	requestId: string;
	createdBy?: string;
}): StripeInvoiceInsert {
	const createdAt = Date.now();

	return {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "package",
		packageId: args.packageId,
		lineItems: args.lineItems,
		totalAmount: sumStripeInvoiceLineItems(args.lineItems),
		paymentStatus: "unpaid",
		createdAt,
		requestId: args.requestId,
		createdBy: args.createdBy
	};
}

export function buildPackageAdjustmentStripeInvoice(args: {
	packageId: Id<"packages">;
	packageAdjustmentId: Id<"packageAdjustments">;
	stripeInvoiceId: string;
	lineItems: StripeInvoiceLineItem[];
	totalAmount: number;
}): StripeInvoiceInsert {
	const createdAt = Date.now();

	return {
		stripeInvoiceId: args.stripeInvoiceId,
		kind: "package_adjustment",
		packageId: args.packageId,
		packageAdjustmentId: args.packageAdjustmentId,
		lineItems: args.lineItems,
		totalAmount: args.totalAmount,
		paymentStatus: "unpaid",
		createdAt
	};
}

export function patchStripeInvoicePaymentStatus(
	ctx: MutationCtx,
	stripeInvoiceRecordId: Id<"stripeInvoices">,
	paidAt: number
) {
	return okOrThrow(
		ctx.db
			.patch("stripeInvoices", stripeInvoiceRecordId, { paymentStatus: "paid", paidAt })
			.then(() => ({ outcome: "completed" as const }) satisfies StripeInvoicePaymentClaim)
	);
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
