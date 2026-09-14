"use node";

import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { emailDomainCanReceiveMail } from "#convex/lib/bookingSubmission";
import { fromConvexTuple, okOrThrow, tryPromise } from "#convex/lib/result";
import type { SessionAvailabilityValidationError } from "#convex/lib/sessionCalendarTime";
import type {
	BuildSessionCheckoutLineItemsInput,
	SessionCheckoutLineItem
} from "#convex/lib/stripeCheckoutLineItems";

export type StripeCheckoutCreateFailed = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" };

export type SessionCheckoutBooking = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	service: string;
	notes?: string;
} & BuildSessionCheckoutLineItemsInput;

type SessionCheckoutDraft = { bookingId: Id<"bookings">; lineItems: SessionCheckoutLineItem[] };

type StripeCheckoutDraft = SessionCheckoutDraft & {
	stripeCustomerId: string;
	session: Stripe.Checkout.Session;
};

export function requireValidBookingEmailDomain(
	email: string
): ResultAsync<null, { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }> {
	return okOrThrow(emailDomainCanReceiveMail(email)).andThen((canReceiveMail) =>
		canReceiveMail ? ok(null) : err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" as const })
	);
}

export function createPendingSessionForCheckout(
	ctx: ActionCtx,
	booking: SessionCheckoutBooking
): ResultAsync<{ bookingId: Id<"bookings"> }, SessionAvailabilityValidationError> {
	return fromConvexTuple(
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
			addons: [...booking.addons],
			essentialEditQuantity: booking.essentialEditQuantity || undefined,
			completeEditQuantity: booking.completeEditQuantity || undefined,
			clipsPackageQuantity: booking.clipsPackageQuantity || undefined,
			handcraftedClipsQuantity: booking.handcraftedClipsQuantity || undefined,
			notes: booking.notes || undefined
		})
	);
}

export function createStripeCheckoutCustomer(
	stripe: Stripe,
	booking: Pick<SessionCheckoutBooking, "email" | "name">,
	checkoutDraft: SessionCheckoutDraft
): ResultAsync<SessionCheckoutDraft & { stripeCustomerId: string }, StripeCheckoutCreateFailed> {
	return tryPromise({
		try: () =>
			stripe.customers
				.create({ email: booking.email, name: booking.name })
				.then((customer) => ({ ...checkoutDraft, stripeCustomerId: customer.id })),
		catch: (cause) => {
			console.error("Stripe customer create failed", { cause });

			return { reason: "STRIPE_CHECKOUT_CREATE_FAILED" as const };
		}
	});
}

export function createEmbeddedStripeCheckoutSession(
	stripe: Stripe,
	checkoutDraft: SessionCheckoutDraft & { stripeCustomerId: string }
): ResultAsync<StripeCheckoutDraft, StripeCheckoutCreateFailed> {
	return tryPromise({
		try: () =>
			stripe.checkout.sessions
				.create({
					mode: "payment",
					ui_mode: "embedded_page",
					payment_method_types: ["card"],
					return_url: `${env.STRIPE_CHECKOUT_RETURN_URL}?session_id={CHECKOUT_SESSION_ID}`,
					customer: checkoutDraft.stripeCustomerId,
					metadata: { bookingId: checkoutDraft.bookingId },
					line_items: checkoutDraft.lineItems
				})
				.then((session) => ({ ...checkoutDraft, session })),
		catch: (cause) => {
			console.error("Stripe checkout session create failed", { cause });

			return { reason: "STRIPE_CHECKOUT_CREATE_FAILED" as const };
		}
	});
}

export function linkStripeCheckoutToPendingBooking(
	ctx: ActionCtx,
	checkoutDraft: StripeCheckoutDraft
): ResultAsync<
	{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
	StripeCheckoutCreateFailed
> {
	const clientSecret = checkoutDraft.session.client_secret;

	if (!clientSecret) {
		return errAsync({ reason: "STRIPE_CHECKOUT_CREATE_FAILED" });
	}

	return okOrThrow(
		ctx
			.runMutation(internal.sessionCheckout.setSessionStripeSessionId, {
				bookingId: checkoutDraft.bookingId,
				stripeSessionId: checkoutDraft.session.id,
				stripeCustomerId: checkoutDraft.stripeCustomerId
			})
			.then(() => ({
				bookingId: checkoutDraft.bookingId,
				clientSecret,
				stripeSessionId: checkoutDraft.session.id
			}))
	);
}
