"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	getAdminBookingReceiptPdfByBookingIdService,
	getAdminPackageReceiptPdfByIdService,
	getBookingInvoicePdfByStripeSessionIdService,
	getBookingReceiptPdfByStripeSessionIdService,
	getPackageReceiptPdfByIdService
} from "#convex/services/invoices";

export const getBookingReceiptPdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		getBookingReceiptPdfByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		getBookingInvoicePdfByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => getPackageReceiptPdfByIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminBookingReceiptPdfByBookingId = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		getAdminBookingReceiptPdfByBookingIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => getAdminPackageReceiptPdfByIdService(ctx, args).match(tupleOk, tupleErr)
});
