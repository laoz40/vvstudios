"use node";

import { v } from "convex/values";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import type { CreateEmbeddedCheckoutSessionError } from "#convex/services/stripe/stripeCheckoutSessionWorkflow";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import { getStripeClient } from "#convex/lib/stripe/stripeClient";
import {
	closeAbandonedBookingStripeCheckout,
	createPendingBookingForStripeCheckout,
	openEmbeddedBookingStripeCheckout,
	parsePublicBookingForCheckout,
	runSessionCheckoutSubmitRateLimit
} from "#convex/services/stripe/stripeCheckoutSessionWorkflow";

// Creates a pending booking, opens a Stripe checkout session, then links both records.
export const createEmbeddedCheckoutSession = action({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string())
	},
	handler: async (
		ctx,
		args
	): Promise<
		Result<
			{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
			CreateEmbeddedCheckoutSessionError
		>
	> => {
		const stripe = getStripeClient();

		return await parsePublicBookingForCheckout(args)
			.andThen((booking) => runSessionCheckoutSubmitRateLimit(ctx, booking))
			.andThen((booking) => createPendingBookingForStripeCheckout(ctx, booking))
			.andThen((checkoutDraft) => openEmbeddedBookingStripeCheckout(ctx, stripe, checkoutDraft))
			.match(tupleOk, tupleErr);
	}
});

export const closeEmbeddedCheckoutSession = action({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await closeAbandonedBookingStripeCheckout(ctx, args).match(tupleOk, tupleErr)
});
