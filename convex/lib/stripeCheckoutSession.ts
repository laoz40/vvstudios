"use node";

import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { emailDomainCanReceiveMail } from "#convex/lib/emailDomain";
import { fromConvexTuple, okOrThrow, tryPromise } from "#convex/lib/result";
import type { SessionAvailabilityValidationError } from "#convex/lib/sessionCalendarTime";
import type {
	BuildSessionCheckoutLineItemsInput,
	PackageCheckoutDiscount,
	SessionCheckoutLineItem
} from "#convex/lib/stripeCheckoutLineItems";

export type StripeCheckoutCreateFailed = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" };

export type StripeCheckoutCloseFailed = { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" };

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

export function createStripeCheckoutCustomer<T extends { lineItems: SessionCheckoutLineItem[] }>(
	stripe: Stripe,
	booking: Pick<SessionCheckoutBooking, "email" | "name">,
	checkoutDraft: T
): ResultAsync<T & { stripeCustomerId: string }, StripeCheckoutCreateFailed> {
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
					line_items: checkoutDraft.lineItems,
					payment_intent_data: { description: "Studio booking" }
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

type PackageCheckoutDraft = {
	packageId: Id<"packages">;
	lineItems: SessionCheckoutLineItem[];
	discount: PackageCheckoutDiscount;
};

type StripePackageCheckoutDraft = PackageCheckoutDraft & {
	stripeCustomerId: string;
	session: Stripe.Checkout.Session;
};

function audToStripeUnitAmount(amount: number) {
	return Math.round(amount * 100);
}

export function createStripeCheckoutDiscountCoupon(
	stripe: Stripe,
	discount: PackageCheckoutDiscount
): ResultAsync<{ couponId: string }, StripeCheckoutCreateFailed> {
	return tryPromise({
		try: () =>
			stripe.coupons
				.create({
					amount_off: audToStripeUnitAmount(discount.amount),
					currency: "aud",
					duration: "once",
					name: discount.description
				})
				.then((coupon) => ({ couponId: coupon.id })),
		catch: (cause) => {
			console.error("Stripe checkout coupon create failed", { cause });

			return { reason: "STRIPE_CHECKOUT_CREATE_FAILED" as const };
		}
	});
}

export function createEmbeddedStripePackageCheckoutSession(
	stripe: Stripe,
	checkoutDraft: PackageCheckoutDraft & { stripeCustomerId: string }
): ResultAsync<StripePackageCheckoutDraft, StripeCheckoutCreateFailed> {
	return createStripeCheckoutDiscountCoupon(stripe, checkoutDraft.discount).andThen(
		({ couponId }) =>
			tryPromise({
				try: () =>
					stripe.checkout.sessions
						.create({
							mode: "payment",
							ui_mode: "embedded_page",
							payment_method_types: ["card"],
							return_url: `${env.STRIPE_CHECKOUT_RETURN_URL}?session_id={CHECKOUT_SESSION_ID}`,
							customer: checkoutDraft.stripeCustomerId,
							metadata: { packageId: checkoutDraft.packageId },
							line_items: checkoutDraft.lineItems,
							discounts: [{ coupon: couponId }],
							payment_intent_data: { description: "Package booking" }
						})
						.then((session) => ({ ...checkoutDraft, session })),
				catch: (cause) => {
					console.error("Stripe package checkout session create failed", { cause });

					return { reason: "STRIPE_CHECKOUT_CREATE_FAILED" as const };
				}
			})
	);
}

type StripeCheckoutCloseLogContext = {
	stripeSessionId: string;
	bookingId?: Id<"bookings">;
	packageId?: Id<"packages">;
};

export function closeOpenStripeCheckoutSession(
	stripe: Stripe,
	stripeSessionId: string,
	logContext: StripeCheckoutCloseLogContext
): ResultAsync<Stripe.Checkout.Session, StripeCheckoutCloseFailed> {
	return tryPromise({
		try: async () => {
			const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

			if (session.status === "open") {
				await stripe.checkout.sessions.expire(stripeSessionId);
			}

			return session;
		},
		catch: (cause) => {
			console.error("Stripe checkout close failed", { ...logContext, cause });

			return { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" as const };
		}
	});
}

export function linkStripeCheckoutToPendingPackage(
	ctx: ActionCtx,
	checkoutDraft: StripePackageCheckoutDraft
): ResultAsync<
	{ packageId: Id<"packages">; clientSecret: string; stripeSessionId: string },
	StripeCheckoutCreateFailed
> {
	const clientSecret = checkoutDraft.session.client_secret;

	if (!clientSecret) {
		return errAsync({ reason: "STRIPE_CHECKOUT_CREATE_FAILED" });
	}

	return okOrThrow(
		ctx
			.runMutation(internal.packageCheckout.setPackageStripeSessionId, {
				packageId: checkoutDraft.packageId,
				stripeSessionId: checkoutDraft.session.id,
				stripeCustomerId: checkoutDraft.stripeCustomerId
			})
			.then(() => ({
				packageId: checkoutDraft.packageId,
				clientSecret,
				stripeSessionId: checkoutDraft.session.id
			}))
	);
}
