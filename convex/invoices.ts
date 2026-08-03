"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { action, type ActionCtx } from "#convex/_generated/server";
import {
	getAdminCustomMultiBookingInvoicePdfByIdService,
	getAdminMultiBookingInvoicePdfByIdService,
	getBookingInvoicePdfByStripeSessionIdService,
	getMultiBookingInvoicePdfByIdService
} from "#convex/services/invoices";

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => getBookingInvoicePdfByStripeSessionIdHandler(ctx, args)
});

function getBookingInvoicePdfByStripeSessionIdHandler(
	ctx: ActionCtx,
	args: { stripeSessionId: string }
) {
	return getBookingInvoicePdfByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr);
}

export type GetBookingInvoicePdfByStripeSessionIdResult = Awaited<
	ReturnType<typeof getBookingInvoicePdfByStripeSessionIdHandler>
>;

export const getMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getMultiBookingInvoicePdfByIdHandler(ctx, args)
});

function getMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	return getMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr);
}

export type GetMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getMultiBookingInvoicePdfByIdHandler>
>;

export const getAdminMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getAdminMultiBookingInvoicePdfByIdHandler(ctx, args)
});

function getAdminMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	return getAdminMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr);
}

export type GetAdminMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminMultiBookingInvoicePdfByIdHandler>
>;

export const getAdminCustomMultiBookingInvoicePdfById = action({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: (ctx, args) => getAdminCustomMultiBookingInvoicePdfByIdHandler(ctx, args)
});

function getAdminCustomMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: { customInvoiceId: Id<"customInvoices"> }
) {
	return getAdminCustomMultiBookingInvoicePdfByIdService(ctx, args).match(tupleOk, tupleErr);
}

export type GetAdminCustomMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminCustomMultiBookingInvoicePdfByIdHandler>
>;
