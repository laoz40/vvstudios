import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, query } from "#convex/_generated/server";
import {
	listBookingStripeInvoicesForAdmin,
	listPackageStripeInvoicesForAdmin,
	markStripeInvoicePaidWithArchive,
	recordBookingStripeInvoiceWithUnarchive,
	recordPackageAdjustmentStripeInvoiceWithUnarchive,
	recordPackageStripeInvoiceWithUnarchive
} from "#convex/stripe/services/stripeInvoiceMutations";

const stripeInvoiceLineItemValidator = v.object({ description: v.string(), amount: v.number() });

export const recordBookingStripeInvoice = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string(),
		createdBy: v.optional(v.string())
	},
	handler: async (ctx, args) =>
		recordBookingStripeInvoiceWithUnarchive(ctx, args).match(tupleOk, tupleErr)
});

export const recordPackageStripeInvoice = internalMutation({
	args: {
		packageId: v.id("packages"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string(),
		createdBy: v.optional(v.string())
	},
	handler: async (ctx, args) =>
		recordPackageStripeInvoiceWithUnarchive(ctx, args).match(tupleOk, tupleErr)
});

export const recordPackageAdjustmentStripeInvoice = internalMutation({
	args: {
		packageId: v.id("packages"),
		packageAdjustmentId: v.id("packageAdjustments"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		totalAmount: v.number()
	},
	handler: async (ctx, args) =>
		recordPackageAdjustmentStripeInvoiceWithUnarchive(ctx, args).match(tupleOk, tupleErr)
});

export const markStripeInvoicePaid = internalMutation({
	args: { stripeInvoiceId: v.string(), paidAt: v.number() },
	handler: async (ctx, args) => markStripeInvoicePaidWithArchive(ctx, args).match(tupleOk, tupleErr)
});

export const listStripeInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		listBookingStripeInvoicesForAdmin(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const listStripeInvoicesForPackage = query({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) =>
		listPackageStripeInvoicesForAdmin(ctx, args.packageId).match(tupleOk, tupleErr)
});
