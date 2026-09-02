"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { bookingAddonQuantitiesValidator } from "#convex/lib/bookingAddonQuantities";
import {
	confirmPackagePaymentService,
	createPackageRequestService,
	resendPackageInvoiceEmailService,
	retryPackageSchedulingEmailService
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
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12))
	},
	handler: (ctx, args) => createPackageRequestService(ctx, args).match(tupleOk, tupleErr)
});

export const resendPackageInvoiceEmail = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => resendPackageInvoiceEmailService(ctx, args).match(tupleOk, tupleErr)
});

export const confirmPackagePayment = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => confirmPackagePaymentService(ctx, args).match(tupleOk, tupleErr)
});

export const retryPackageSchedulingEmail = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => retryPackageSchedulingEmailService(ctx, args).match(tupleOk, tupleErr)
});
