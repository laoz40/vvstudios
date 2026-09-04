"use node";

import { err, errAsync, ok, ResultAsync } from "neverthrow";
import Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import {
	emailDomainCanReceiveMail,
	getBookingSubmitRateLimitKey
} from "#convex/lib/bookingSubmission";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import type { SessionAvailabilityValidationError } from "#convex/lib/sessionCalendarTime";
import { publicBookingSchema } from "#studio/features/booking-form/lib/booking-form-model";

export type CreateEmbeddedCheckoutSessionArgs = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: string[];
	notes?: string;
} & BookingAddonQuantitiesArgs;

export type CreateEmbeddedCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| SessionAvailabilityValidationError;

export type CloseEmbeddedCheckoutSessionError =
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };
type CloseEmbeddedCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

type StripeClient = ReturnType<typeof getStripeClient>;

function getStripeClient() {
	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
}

export function createEmbeddedCheckoutSessionService(
	ctx: ActionCtx,
	args: CreateEmbeddedCheckoutSessionArgs,
	stripe: StripeClient = getStripeClient()
): ResultAsync<
	{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
	CreateEmbeddedCheckoutSessionError
> {
	const parsedBooking = publicBookingSchema.safeParse({
		...args,
		bookingMode: "single",
		packageSize: ""
	});

	if (!parsedBooking.success) {
		return errAsync({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	const booking = parsedBooking.data;

	return (
		fromConvexTuple(
			ctx.runMutation(internal.sessionCheckout.checkSessionSubmitRateLimit, {
				submitRateLimitKey: getBookingSubmitRateLimitKey(booking.email)
			})
		)
			// Reject addresses that cannot receive the booking invoice before creating records.
			.andThen(() =>
				okOrThrow(emailDomainCanReceiveMail(booking.email)).andThen((isDeliverable) =>
					isDeliverable ? ok(null) : err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" as const })
				)
			)
			// Persist the pending booking so its ID can identify the Stripe checkout.
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessionCheckout.createPendingSession, {
						name: booking.name,
						phone: booking.phone,
						accountName: booking.accountName,
						abn: booking.abn,
						email: booking.email,
						date: booking.date,
						time: booking.time,
						duration: booking.duration,
						service: booking.service,
						addons: booking.addons,
						essentialEditQuantity: booking.essentialEditQuantity || undefined,
						completeEditQuantity: booking.completeEditQuantity || undefined,
						clipsPackageQuantity: booking.clipsPackageQuantity || undefined,
						handcraftedClipsQuantity: booking.handcraftedClipsQuantity || undefined,
						notes: booking.notes || undefined
					})
				)
			)
			// Create the embedded checkout for the deposit and processing fee.
			.andThen(({ bookingId }) =>
				okOrThrow(
					stripe.checkout.sessions
						.create({
							mode: "payment",
							ui_mode: "embedded_page",
							payment_method_types: ["card"],
							return_url: `${env.STRIPE_CHECKOUT_RETURN_URL}?session_id={CHECKOUT_SESSION_ID}`,
							customer_email: booking.email,
							metadata: { bookingId },
							line_items: [
								{ price: env.STRIPE_BOOKING_DEPOSIT_PRICE_ID, quantity: 1 },
								{ price: env.STRIPE_PROCESSING_FEE_PRICE_ID, quantity: 1 }
							]
						})
						.then((session) => ({ bookingId, session }))
				)
			)
			// Link both records so webhooks and cleanup target the same booking.
			.andThen(({ bookingId, session }) => {
				const clientSecret = session.client_secret;

				if (!clientSecret) {
					throw new Error("Stripe checkout session missing client secret");
				}

				return okOrThrow(
					ctx
						.runMutation(internal.sessionCheckout.setSessionStripeSessionId, {
							bookingId,
							stripeSessionId: session.id
						})
						.then(() => ({ bookingId, clientSecret, stripeSessionId: session.id }))
				);
			})
	);
}

export function closeEmbeddedCheckoutSessionService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string },
	stripe: StripeClient = getStripeClient()
): ResultAsync<CloseEmbeddedCheckoutSessionSuccess, CloseEmbeddedCheckoutSessionError> {
	return ResultAsync.fromPromise(
		stripe.checkout.sessions.retrieve(args.stripeSessionId).then(async (session) => {
			if (session.status === "open") {
				await stripe.checkout.sessions.expire(args.stripeSessionId);
			}

			return session;
		}),
		() => ({ reason: "STRIPE_CHECKOUT_CLOSE_FAILED" as const })
	).andThen((session) => {
		if (session.status === "complete") {
			return ok<CloseEmbeddedCheckoutSessionSuccess>({ outcome: "already_complete" });
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionCheckout.deletePendingSession, args)
		).map<CloseEmbeddedCheckoutSessionSuccess>(({ outcome }) => ({ outcome }));
	});
}
