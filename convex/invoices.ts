"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	getAdminCustomMultiBookingInvoicePdfByIdService,
	getAdminMultiBookingInvoicePdfByIdService,
	getBookingInvoicePdfByStripeSessionIdService,
	getMultiBookingInvoicePdfByIdService
} from "#convex/services/invoices";

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		getBookingInvoicePdfByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) =>
		getAdminMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminCustomMultiBookingInvoicePdfById = action({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: (ctx, args) =>
		getAdminCustomMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});
