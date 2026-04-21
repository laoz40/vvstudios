import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import Stripe from "stripe";
import { env } from "./env";

const http = httpRouter();

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	apiVersion: "2026-03-25.dahlia",
});

http.route({
	path: "/stripe/webhook",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const signature = req.headers.get("stripe-signature");

		if (!signature) {
			return new Response("Missing Stripe signature header", {
				status: 400,
			});
		}

		const body = await req.text();

		let event: Stripe.Event;

		try {
			event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
		} catch (error) {
			console.error("Invalid Stripe webhook signature", error);
			return new Response("Invalid Stripe webhook signature", {
				status: 400,
			});
		}


		if (event.type === "checkout.session.completed") {
			const session = event.data.object as Stripe.Checkout.Session;

			const bookingId = session.metadata?.bookingId;
			if (!bookingId) {
				console.error("Stripe checkout session missing bookingId metadata", {
					eventId: event.id,
					sessionId: session.id,
				});
				return new Response("Missing bookingId metadata", { status: 400 });
			}

			const stripePaymentIntentId =
				typeof session.payment_intent === "string"
					? session.payment_intent
					: session.payment_intent?.id;

			const result = await ctx.runMutation(internal.bookings.claimBookingCompletion, {
				bookingId: bookingId as Id<"bookings">,
				stripeSessionId: session.id,
				stripePaymentIntentId,
				stripeEventId: event.id,
			});

			if (!result.ok) {
				console.error("Booking completion claim failed", {
					eventId: event.id,
					sessionId: session.id,
					bookingId,
					result,
				});

				return new Response("claim failed", { status: 200 });
			}

			if (result.outcome === "already_confirmed") {
				return new Response("already confirmed", { status: 200 });
			}

			if (result.outcome === "already_claimed") {
				return new Response("already claimed", { status: 200 });
			}

			await ctx.runAction(internal.googleCalendar.completeClaimedBooking, {
				bookingId: bookingId as Id<"bookings">,
			});

			return new Response("confirmed", { status: 200 });
		}

		if (event.type === "checkout.session.expired") {
			const session = event.data.object as Stripe.Checkout.Session;

			const result = await ctx.runMutation(internal.bookings.markBookingExpiredByStripeSessionId, {
				stripeSessionId: session.id,
			});

			return new Response("expired", { status: 200 });
		}

		return new Response("ignored", { status: 200 });
	}),
});

export default http;
