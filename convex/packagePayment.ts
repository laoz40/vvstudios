"use node";

import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	closeEmbeddedPackageCheckoutSessionService,
	createPackageCheckoutSessionService
} from "#convex/services/packages/packageCheckoutActions";
import { resendPackageEmailService } from "#convex/services/packages/packagePayment";

const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

const bookingAddonsValidator = v.array(bookingAddonValidator);

const bookingAddonQuantitiesValidator = {
	essentialEditQuantity: v.optional(v.string()),
	completeEditQuantity: v.optional(v.string()),
	clipsPackageQuantity: v.optional(v.string()),
	handcraftedClipsQuantity: v.optional(v.string())
};

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
