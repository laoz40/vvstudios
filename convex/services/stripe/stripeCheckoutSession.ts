"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { getBookingSubmitRateLimitKey } from "#convex/lib/booking/bookingSubmission";
import { fromConvexTuple } from "#convex/lib/result";
import { getStripeClient } from "#convex/lib/stripe/stripeClient";
import { buildSessionCheckoutLineItems } from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";
import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripeCheckoutSession,
	createPendingSessionForCheckout,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingBooking,
	requireValidBookingEmailDomain
} from "#convex/lib/stripe/stripeCheckoutSession";
import type { SessionAvailabilityValidationError } from "#convex/lib/sessions/sessionCalendarTime";
import {
	publicBookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

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

function keepBooking(booking: BookingFormValues) {
	return booking;
}

function enforceSessionSubmitRateLimit(
	ctx: ActionCtx,
	booking: BookingFormValues,
	submitRateLimitKey: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionCheckout.checkSessionSubmitRateLimit, { submitRateLimitKey })
	).map(() => keepBooking(booking));
}

export function parsePublicBookingForCheckout(
	args: CreateEmbeddedCheckoutSessionArgs
): ResultAsync<BookingFormValues, { reason: "BOOKING_INVALID_INPUT" }> {
	const parsedBooking = publicBookingSchema.safeParse({
		...args,
		bookingMode: "single",
		packageSize: ""
	});

	if (!parsedBooking.success) {
		return errAsync({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	return okAsync(parsedBooking.data);
}

export function runSessionCheckoutSubmitRateLimit(
	ctx: ActionCtx,
	booking: BookingFormValues
): ResultAsync<
	BookingFormValues,
	{ reason: "BOOKING_RATE_LIMITED"; retryAfter?: number } | CreateEmbeddedCheckoutSessionError
> {
	return getBookingSubmitRateLimitKey(booking.email).andThen((submitRateLimitKey: string) =>
		enforceSessionSubmitRateLimit(ctx, booking, submitRateLimitKey)
	);
}

function attachSessionCheckoutLineItems(
	booking: BookingFormValues,
	bookingId: Id<"bookings">,
	lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"]
) {
	return { booking, bookingId, lineItems };
}

function buildSessionCheckoutDraft(
	booking: BookingFormValues,
	{ bookingId }: { bookingId: Id<"bookings"> }
) {
	return buildSessionCheckoutLineItems(booking).map(
		(lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"]) =>
			attachSessionCheckoutLineItems(booking, bookingId, lineItems)
	);
}

function createPendingSessionForCheckoutDraft(ctx: ActionCtx, booking: BookingFormValues) {
	return createPendingSessionForCheckout(ctx, booking).andThen((_value) =>
		buildSessionCheckoutDraft(booking, _value)
	);
}

export function createPendingBookingForStripeCheckout(
	ctx: ActionCtx,
	booking: BookingFormValues
): ResultAsync<
	{
		booking: BookingFormValues;
		bookingId: Id<"bookings">;
		lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"];
	},
	CreateEmbeddedCheckoutSessionError
> {
	return requireValidBookingEmailDomain(booking.email).andThen(() =>
		createPendingSessionForCheckoutDraft(ctx, booking)
	);
}

export function openEmbeddedBookingStripeCheckout(
	ctx: ActionCtx,
	checkoutDraft: {
		booking: BookingFormValues;
		bookingId: Id<"bookings">;
		lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"];
	}
): ResultAsync<
	{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
	CreateEmbeddedCheckoutSessionError
> {
	const stripe = getStripeClient();

	return createStripeCheckoutCustomer(stripe, checkoutDraft.booking, {
		bookingId: checkoutDraft.bookingId,
		lineItems: checkoutDraft.lineItems
	})
		.andThen((draft) => createEmbeddedStripeCheckoutSession(stripe, draft))
		.andThen((draft) => linkStripeCheckoutToPendingBooking(ctx, draft));
}

function deletePendingSessionAfterClose(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
) {
	return fromConvexTuple(ctx.runMutation(internal.sessionCheckout.deletePendingSession, args)).map(
		mapDeletePendingSessionOutcome
	);
}

function mapDeletePendingSessionOutcome(result: {
	outcome: CloseEmbeddedCheckoutSessionSuccess["outcome"];
}) {
	return { outcome: result.outcome };
}

function resolveClosedBookingCheckoutSession(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string },

	session: Stripe.Checkout.Session
) {
	if (session.status === "complete") {
		return okAsync({ outcome: "already_complete" as const });
	}

	return deletePendingSessionAfterClose(ctx, args);
}

export function closeAbandonedBookingStripeCheckout(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): ResultAsync<CloseEmbeddedCheckoutSessionSuccess, CloseEmbeddedCheckoutSessionError> {
	const stripe = getStripeClient();

	return closeOpenStripeCheckoutSession(stripe, args.stripeSessionId, {
		bookingId: args.bookingId,
		stripeSessionId: args.stripeSessionId
	}).andThen((session: Stripe.Checkout.Session) =>
		resolveClosedBookingCheckoutSession(ctx, args, session)
	);
}
