"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	getAdminCustomPackageInvoicePdfByIdService,
	getAdminPackageInvoicePdfByIdService,
	getBookingInvoicePdfByStripeSessionIdService,
	getPackageInvoicePdfByIdService
} from "#convex/services/invoices";

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		getBookingInvoicePdfByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getPackageInvoicePdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => getPackageInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminPackageInvoicePdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => getAdminPackageInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getAdminCustomPackageInvoicePdfById = action({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: (ctx, args) =>
		getAdminCustomPackageInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr)
});
