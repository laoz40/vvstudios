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

interface CloseEmbeddedCheckoutSessionResult {
	ok: true;
	outcome: "already_complete" | "deleted" | "not_found" | "not_pending";
}

type DeletePendingBookingResult =
	| { ok: true; outcome: "deleted" | "not_found" | "not_pending" }
	| { ok: false; reason: "stripe_session_mismatch" };

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
			payment_method_types: ["card"],
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

export const closeEmbeddedCheckoutSession = action({
	args: {
		bookingId: v.id("bookings"),
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args): Promise<CloseEmbeddedCheckoutSessionResult> => {
		const stripe = getStripeClient();
		const session = await stripe.checkout.sessions.retrieve(args.stripeSessionId);

		if (session.status === "complete") {
			return { ok: true as const, outcome: "already_complete" as const };
		}

		if (session.status === "open") {
			await stripe.checkout.sessions.expire(args.stripeSessionId);
		}

		const result: DeletePendingBookingResult = await ctx.runMutation(
			internal.bookings.deletePendingBooking,
			{
				bookingId: args.bookingId,
				stripeSessionId: args.stripeSessionId,
			},
		);

		if (!result.ok) {
			throw new Error(result.reason);
		}

		return { ok: true as const, outcome: result.outcome };
	},
});
