import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { env } from "./env";
import { completeSessionCheckoutService } from "./services/bookingConfirmation";

const http = httpRouter();

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });

async function handleCompletedCheckout(
	ctx: ActionCtx,
	event: Stripe.CheckoutSessionCompletedEvent
) {
	const session = event.data.object;
	const bookingId = session.metadata?.bookingId;

	if (!bookingId) {
		console.error("Stripe checkout session missing bookingId metadata", {
			eventId: event.id,
			sessionId: session.id
		});
		return new Response("Missing bookingId metadata", { status: 400 });
	}

	const stripePaymentIntentId =
		typeof session.payment_intent === "string"
			? session.payment_intent
			: session.payment_intent?.id;
	const checkoutCompletion = await completeSessionCheckoutService(ctx, {
		bookingId,
		stripeSessionId: session.id,
		stripePaymentIntentId,
		stripeEventId: event.id
	});

	return checkoutCompletion.match(
		({ outcome }) => {
			switch (outcome) {
				case "already_confirmed":
					return new Response("already confirmed", { status: 200 });
				case "already_claimed":
					return new Response("already claimed", { status: 200 });
				case "completed":
				case "already_completed":
					return new Response("confirmed", { status: 200 });
				case "booking_time_unavailable":
				case "booking_invalid_input":
				case "google_calendar_create_failed":
				case "reservation_lost":
					return new Response(outcome, { status: 200 });
				default: {
					const _exhaustive: never = outcome;
					return _exhaustive;
				}
			}
		},
		(failure) => {
			switch (failure.kind) {
				case "claim_failed":
					console.error("Booking completion claim failed", {
						eventId: event.id,
						sessionId: session.id,
						bookingId,
						claimError: failure.error
					});
					return new Response("claim failed", { status: 200 });
				case "completion_failed":
					console.error("Booking completion failed", {
						eventId: event.id,
						sessionId: session.id,
						bookingId,
						completionError: failure.error
					});
					return new Response("completion failed", { status: 200 });
				default: {
					const _exhaustive: never = failure;
					return _exhaustive;
				}
			}
		}
	);
}

async function handleStripeEvent(ctx: ActionCtx, event: Stripe.Event) {
	if (event.type === "checkout.session.completed") {
		return handleCompletedCheckout(ctx, event);
	}

	if (event.type === "checkout.session.expired") {
		await ctx.runMutation(internal.sessionCheckout.markSessionExpiredByStripeSessionId, {
			stripeSessionId: event.data.object.id
		});
		return new Response("expired", { status: 200 });
	}

	return new Response("ignored", { status: 200 });
}

http.route({
	path: "/stripe/webhook",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const signature = req.headers.get("stripe-signature");

		if (!signature) {
			return new Response("Missing Stripe signature header", { status: 400 });
		}

		const body = await req.text();
		let event: Stripe.Event;

		try {
			event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
		} catch (error) {
			console.error("Invalid Stripe webhook signature", error);
			return new Response("Invalid Stripe webhook signature", { status: 400 });
		}

		return handleStripeEvent(ctx, event);
	})
});

export default http;
