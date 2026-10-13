"use node";

import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	createAndRecordBookingStripeInvoice,
	createAndRecordPackageStripeInvoice,
	loadBookingStripeCustomerId,
	loadPackageStripeCustomerId,
	loadStripeInvoiceBillingUrlsForStaff,
	requireSendReceiptEmailsAndValidateLineItems
} from "#convex/stripe/services/invoiceSend";

const stripeInvoiceLineItemValidator = v.object({ description: v.string(), amount: v.number() });

export const sendBookingStripeInvoice = action({
	args: {
		bookingId: v.id("bookings"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		await safeTry(async function* () {
			const { identity, lineItems } = yield* requireSendReceiptEmailsAndValidateLineItems(
				ctx,
				args.lineItems
			);

			const stripeCustomerId = yield* loadBookingStripeCustomerId(ctx, args.bookingId);

			const invoice = yield* createAndRecordBookingStripeInvoice(
				ctx,
				{ bookingId: args.bookingId, lineItems, requestId: args.requestId },
				identity,
				stripeCustomerId
			);

			return ok(invoice);
		}).match(tupleOk, tupleErr)
});

export const sendPackageStripeInvoice = action({
	args: {
		packageId: v.id("packages"),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string()
	},
	handler: async (ctx, args) =>
		await safeTry(async function* () {
			const { identity, lineItems } = yield* requireSendReceiptEmailsAndValidateLineItems(
				ctx,
				args.lineItems
			);

			const stripeCustomerId = yield* loadPackageStripeCustomerId(ctx, args.packageId);

			const invoice = yield* createAndRecordPackageStripeInvoice(
				ctx,
				{ packageId: args.packageId, lineItems, requestId: args.requestId },
				identity,
				stripeCustomerId
			);

			return ok(invoice);
		}).match(tupleOk, tupleErr)
});

export const getStripeInvoiceBillingUrls = action({
	args: { stripeInvoiceId: v.string() },
	handler: async (ctx, args) =>
		await loadStripeInvoiceBillingUrlsForStaff(ctx, args.stripeInvoiceId).match(tupleOk, tupleErr)
});
