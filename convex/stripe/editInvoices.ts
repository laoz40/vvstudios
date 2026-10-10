import { v } from "convex/values";
import { tupleOk, tupleErr } from "#/lib/result";
import { internalQuery, internalMutation } from "#convex/_generated/server";
import {
	loadEditInvoiceContext,
	loadMissingCheckoutPayments,
	saveOriginalPaidAmount
} from "#convex/stripe/services/editInvoiceBilling";
import { editInvoiceDraftValidator } from "#convex/stripe/services/editInvoiceValidators";

export const editInvoiceTargetValidator = v.union(
	v.object({ kind: v.literal("booking"), bookingId: v.id("bookings") }),
	v.object({ kind: v.literal("package"), packageId: v.id("packages") })
);

export const getContext = internalQuery({
	args: { target: editInvoiceTargetValidator, draft: v.optional(editInvoiceDraftValidator) },
	handler: (ctx, args) => loadEditInvoiceContext(ctx, args).match(tupleOk, tupleErr)
});

export const getMissingPayments = internalQuery({
	args: {
		table: v.union(v.literal("bookings"), v.literal("packages")),
		cursor: v.union(v.string(), v.null())
	},
	handler: (ctx, args) => loadMissingCheckoutPayments(ctx, args).match(tupleOk, tupleErr)
});

export const cacheOriginalPayment = internalMutation({
	args: { target: editInvoiceTargetValidator, amount: v.number(), stripeSessionId: v.string() },
	handler: (ctx, args) => saveOriginalPaidAmount(ctx, args).match(tupleOk, tupleErr)
});
