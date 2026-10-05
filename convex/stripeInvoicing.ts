"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { getStripeInvoiceBillingUrlsService } from "#convex/services/stripe/stripeInvoiceBillingUrls";
import {
	createAndRecordBookingStripeInvoice,
	createAndRecordPackageStripeInvoice,
	loadBookingStripeCustomerId,
	loadPackageStripeCustomerId,
	requireSendReceiptEmailsAndValidateLineItems
} from "#convex/services/stripe/stripeInvoiceSendWorkflow";

const stripeInvoiceLineItemValidator = v.object({ description: v.string(), amount: v.number() });

export const sendBookingStripeInvoice = action({
	args: {
		bookingId: v.id("bookings"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		await requireSendReceiptEmailsAndValidateLineItems(ctx, args.lineItems)
			.andThen(({ identity, lineItems }) =>
				loadBookingStripeCustomerId(ctx, args.bookingId).map((stripeCustomerId) => ({
					identity,
					lineItems,
					stripeCustomerId
				}))
			)
			.andThen(({ identity, lineItems, stripeCustomerId }) =>
				createAndRecordBookingStripeInvoice(
					ctx,
					{ bookingId: args.bookingId, lineItems, requestId: args.requestId },
					identity,
					stripeCustomerId
				)
			)
			.match(tupleOk, tupleErr)
});

export const sendPackageStripeInvoice = action({
	args: {
		packageId: v.id("packages"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		await requireSendReceiptEmailsAndValidateLineItems(ctx, args.lineItems)
			.andThen(({ identity, lineItems }) =>
				loadPackageStripeCustomerId(ctx, args.packageId).map((stripeCustomerId) => ({
					identity,
					lineItems,
					stripeCustomerId
				}))
			)
			.andThen(({ identity, lineItems, stripeCustomerId }) =>
				createAndRecordPackageStripeInvoice(
					ctx,
					{ packageId: args.packageId, lineItems, requestId: args.requestId },
					identity,
					stripeCustomerId
				)
			)
			.match(tupleOk, tupleErr)
});

export const getStripeInvoiceBillingUrls = action({
	args: { stripeInvoiceId: v.string() },
	handler: async (ctx, args) =>
		(await getStripeInvoiceBillingUrlsService(ctx, args)).match(tupleOk, tupleErr)
});
