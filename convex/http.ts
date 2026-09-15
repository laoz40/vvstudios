import { httpRouter } from "convex/server";
import { exhaustiveCheck } from "#/lib/result";
import { httpAction, type ActionCtx } from "#convex/_generated/server";
import { internal } from "#convex/_generated/api";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "#convex/env";
import { completeSessionCheckoutService } from "#convex/services/bookingConfirmation";
import { completePackageAdjustmentInvoicePaymentService } from "#convex/services/packageAdjustmentInvoicePayment";
import { completePackageCheckoutService } from "#convex/services/packageCheckoutCompletion";

const http = httpRouter();

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });

const stripePaymentIntentIdSchema = z.union([z.string(), z.object({ id: z.string() })]);

function getStripePaymentIntentId(
	paymentIntent: Stripe.Checkout.Session["payment_intent"]
): string | undefined {
	const parsedPaymentIntent = stripePaymentIntentIdSchema.safeParse(paymentIntent);

	if (!parsedPaymentIntent.success) {
		return undefined;
	}

	const stringPaymentIntent = z.string().safeParse(parsedPaymentIntent.data);

	if (stringPaymentIntent.success) {
		return stringPaymentIntent.data;
	}

	const objectPaymentIntent = z.object({ id: z.string() }).safeParse(parsedPaymentIntent.data);

	return objectPaymentIntent.success ? objectPaymentIntent.data.id : undefined;
}

async function handleCompletedCheckout(
	ctx: ActionCtx,
	event: Stripe.CheckoutSessionCompletedEvent
) {
	const session = event.data.object;
	const packageId = session.metadata?.packageId;

	if (packageId) {
		const stripePaymentIntentId = getStripePaymentIntentId(session.payment_intent);

		const checkoutCompletion = await completePackageCheckoutService(ctx, {
			packageId,
			stripeSessionId: session.id,
			stripePaymentIntentId
		});

		return checkoutCompletion.match(
			({ outcome }) => {
				switch (outcome) {
					case "already_completed":
						return new Response("already completed", { status: 200 });
					case "completed":
						return new Response("confirmed", { status: 200 });
					default:
						return exhaustiveCheck(outcome);
				}
			},
			(failure) => {
				const failureKind = failure.kind;

				switch (failureKind) {
					case "claim_failed":
						console.error("Package completion claim failed", {
							eventId: event.id,
							sessionId: session.id,
							packageId,
							claimError: failure.error
						});

						return new Response("claim failed", { status: 200 });
					case "completion_failed":
						console.error("Package completion failed", {
							eventId: event.id,
							sessionId: session.id,
							packageId,
							completionError: failure.error
						});

						return new Response("completion failed", { status: 200 });
					default:
						return exhaustiveCheck(failureKind);
				}
			}
		);
	}

	const bookingId = session.metadata?.bookingId;

	if (!bookingId) {
		console.error("Stripe checkout session missing bookingId metadata", {
			eventId: event.id,
			sessionId: session.id
		});

		return new Response("Missing bookingId metadata", { status: 400 });
	}

	const stripePaymentIntentId = getStripePaymentIntentId(session.payment_intent);

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
				default:
					return exhaustiveCheck(outcome);
			}
		},
		(failure) => {
			const failureKind = failure.kind;

			switch (failureKind) {
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
				default:
					return exhaustiveCheck(failureKind);
			}
		}
	);
}

async function handlePaidInvoice(ctx: ActionCtx, event: Stripe.InvoicePaidEvent) {
	const invoice = event.data.object;
	const stripeInvoiceId = invoice.id;
	const adjustmentId = invoice.metadata?.adjustmentId;

	const paymentCompletion = await completePackageAdjustmentInvoicePaymentService(ctx, {
		stripeInvoiceId,
		adjustmentId,
		paidAt: Date.now()
	});

	return paymentCompletion.match(
		({ outcome }) => {
			switch (outcome) {
				case "already_completed":
					return new Response("already completed", { status: 200 });
				case "completed":
					return new Response("paid", { status: 200 });
				default:
					return exhaustiveCheck(outcome);
			}
		},
		(failure) => {
			const failureKind = failure.kind;

			switch (failureKind) {
				case "claim_failed":
					console.error("Package adjustment invoice payment claim failed", {
						eventId: event.id,
						stripeInvoiceId,
						adjustmentId,
						claimError: failure.error
					});

					return new Response("claim failed", { status: 200 });
				case "completion_failed":
					console.error("Package adjustment receipt email failed", {
						eventId: event.id,
						stripeInvoiceId,
						adjustmentId,
						completionError: failure.error
					});

					return new Response("completion failed", { status: 200 });
				default:
					return exhaustiveCheck(failureKind);
			}
		}
	);
}

async function handleStripeEvent(ctx: ActionCtx, event: Stripe.Event) {
	if (event.type === "checkout.session.completed") {
		return handleCompletedCheckout(ctx, event);
	}

	if (event.type === "invoice.paid") {
		return handlePaidInvoice(ctx, event);
	}

	if (event.type === "checkout.session.expired") {
		const stripeSessionId = event.data.object.id;

		await ctx.runMutation(internal.sessionCheckout.markSessionExpiredByStripeSessionId, {
			stripeSessionId
		});
		await ctx.runMutation(internal.packageCheckout.markPackageExpiredByStripeSessionId, {
			stripeSessionId
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
