"use node";

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { err as tupleErr, ok as tupleOk, type Result } from "#/lib/result";
import {
	confirmPackagePaymentService,
	createPackageRequestService,
	resendPackageInvoiceEmailService,
	retryPackageSchedulingEmailService,
	type ConfirmPackagePaymentError,
	type CreatePackageRequestArgs,
	type CreatePackageRequestError,
	type CreatePackageRequestSuccess,
	type ResendPackageInvoiceEmailError,
	type ResendPackageInvoiceEmailSuccess,
	type RetryPackageSchedulingEmailError
} from "./services/packagePayment";

export const createPackageRequest = action({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12))
	},
	handler: (ctx, args) => createPackageRequestHandler(ctx, args)
});

function createPackageRequestHandler(
	ctx: ActionCtx,
	args: CreatePackageRequestArgs
): Promise<Result<CreatePackageRequestSuccess, CreatePackageRequestError>> {
	return createPackageRequestService(ctx, args).match(tupleOk, tupleErr);
}

export type CreatePackageRequestResult = Awaited<ReturnType<typeof createPackageRequestHandler>>;

export const resendPackageInvoiceEmail = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => resendPackageInvoiceEmailHandler(ctx, args)
});

function resendPackageInvoiceEmailHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
): Promise<Result<ResendPackageInvoiceEmailSuccess, ResendPackageInvoiceEmailError>> {
	return resendPackageInvoiceEmailService(ctx, args).match(tupleOk, tupleErr);
}

export type ResendPackageInvoiceEmailResult = Awaited<
	ReturnType<typeof resendPackageInvoiceEmailHandler>
>;

export const confirmPackagePayment = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => confirmPackagePaymentHandler(ctx, args)
});

function confirmPackagePaymentHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
): Promise<Result<null, ConfirmPackagePaymentError>> {
	return confirmPackagePaymentService(ctx, args).match(tupleOk, tupleErr);
}

export type ConfirmPackagePaymentResult = Awaited<ReturnType<typeof confirmPackagePaymentHandler>>;

export const retryPackageSchedulingEmail = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => retryPackageSchedulingEmailHandler(ctx, args)
});

function retryPackageSchedulingEmailHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
): Promise<Result<null, RetryPackageSchedulingEmailError>> {
	return retryPackageSchedulingEmailService(ctx, args).match(tupleOk, tupleErr);
}

export type RetryPackageSchedulingEmailResult = Awaited<
	ReturnType<typeof retryPackageSchedulingEmailHandler>
>;
