"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	sendBookingStripeInvoiceService,
	sendPackageStripeInvoiceService
} from "#convex/services/stripeInvoicing";

const stripeInvoiceLineItemValidator = v.object({ description: v.string(), amount: v.number() });

export const sendBookingStripeInvoice = action({
	args: {
		bookingId: v.id("bookings"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		(await sendBookingStripeInvoiceService(ctx, args)).match(tupleOk, tupleErr)
});

export const sendPackageStripeInvoice = action({
	args: {
		packageId: v.id("packages"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		(await sendPackageStripeInvoiceService(ctx, args)).match(tupleOk, tupleErr)
});
