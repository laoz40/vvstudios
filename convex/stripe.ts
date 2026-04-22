"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { env } from "./env";

interface CreateEmbeddedCheckoutSessionResult {
	bookingId: Id<"bookings">;
	clientSecret: string;
	stripeSessionId: string;
}

function getStripeClient() {
	return new Stripe(env.STRIPE_SECRET_KEY, {
		apiVersion: "2026-03-25.dahlia",
	});
}

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
		addons: v.array(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<CreateEmbeddedCheckoutSessionResult> => {
		const stripe = getStripeClient();

		const bookingId: Id<"bookings"> = await ctx.runMutation(
			internal.bookings.createPendingBooking,
			{
				name: args.name,
				phone: args.phone,
				accountName: args.accountName,
				abn: args.abn,
				email: args.email,
				date: args.date,
				time: args.time,
				duration: args.duration,
				service: args.service,
				addons: args.addons,
				notes: args.notes,
			},
		);

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			ui_mode: "embedded_page",
			return_url: `${env.STRIPE_CHECKOUT_RETURN_URL}?session_id={CHECKOUT_SESSION_ID}`,
			customer_email: args.email,
			metadata: {
				bookingId,
			},
			line_items: [
				{
					price: "price_1TOJj136IpJeqJz3PPvcx7Uc",
					quantity: 1,
				},
			],
		});

		if (!session.client_secret) {
			throw new Error("Stripe checkout session missing client secret");
		}

		await ctx.runMutation(internal.bookings.setBookingStripeSessionId, {
			bookingId,
			stripeSessionId: session.id,
		});

		return {
			bookingId,
			clientSecret: session.client_secret,
			stripeSessionId: session.id,
		};
	},
});
