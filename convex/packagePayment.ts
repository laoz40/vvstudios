"use node";

import { v } from "convex/values";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/bookingAddonQuantities";
import {
	closeEmbeddedPackageCheckoutSessionService,
	createPackageCheckoutSessionService
} from "#convex/services/packageCheckoutActions";
import { resendPackageEmailService } from "#convex/services/packagePayment";

export const createPackageCheckoutSession = action({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12))
	},
	handler: (ctx, args) => createPackageCheckoutSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const closeEmbeddedPackageCheckoutSession = action({
	args: { packageId: v.id("packages"), stripeSessionId: v.string() },
	handler: (ctx, args) =>
		closeEmbeddedPackageCheckoutSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const resendPackageEmail = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => resendPackageEmailService(ctx, args).match(tupleOk, tupleErr)
});
