"use node";

import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { getBookingSubmitRateLimitKey } from "#convex/lib/bookingSubmission";
import { fromConvexTuple } from "#convex/lib/result";
import { getStripeClient, type StripeClient } from "#convex/lib/stripeClient";
import { buildSessionCheckoutLineItems } from "#convex/lib/stripeCheckoutLineItems";
import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripeCheckoutSession,
	createPendingSessionForCheckout,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingBooking,
	requireValidBookingEmailDomain
} from "#convex/lib/stripeCheckoutSession";
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
	addons: BookingAddon[];
	notes?: string;
} & BookingAddonQuantitiesArgs;

export type CreateEmbeddedCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| { reason: "STRIPE_CHECKOUT_CREATE_FAILED" }
	| SessionAvailabilityValidationError;

export type CloseEmbeddedCheckoutSessionError =
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };

type CloseEmbeddedCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

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

	return getBookingSubmitRateLimitKey(booking.email)
		.andThen((submitRateLimitKey) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessionCheckout.checkSessionSubmitRateLimit, {
					submitRateLimitKey
				})
			)
		)
		.andThen(() => requireValidBookingEmailDomain(booking.email))
		.andThen(() => createPendingSessionForCheckout(ctx, booking))
		.andThen(({ bookingId }) =>
			buildSessionCheckoutLineItems(booking).map((lineItems) => ({ bookingId, lineItems }))
		)
		.andThen((checkoutDraft) => createStripeCheckoutCustomer(stripe, booking, checkoutDraft))
		.andThen((checkoutDraft) => createEmbeddedStripeCheckoutSession(stripe, checkoutDraft))
		.andThen((checkoutDraft) => linkStripeCheckoutToPendingBooking(ctx, checkoutDraft));
}

export function closeEmbeddedCheckoutSessionService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string },
	stripe: StripeClient = getStripeClient()
): ResultAsync<CloseEmbeddedCheckoutSessionSuccess, CloseEmbeddedCheckoutSessionError> {
	return closeOpenStripeCheckoutSession(stripe, args.stripeSessionId, {
		bookingId: args.bookingId,
		stripeSessionId: args.stripeSessionId
	}).andThen((session) => {
		if (session.status === "complete") {
			return okAsync({ outcome: "already_complete" as const });
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionCheckout.deletePendingSession, args)
		).map(({ outcome }) => ({ outcome }));
	});
}
