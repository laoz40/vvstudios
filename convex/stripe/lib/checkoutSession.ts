"use node";

import { errAsync, type ResultAsync } from "neverthrow";
import Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { logError } from "#convex/shared/lib/logger";
import { fromConvexTuple, tryPromise } from "#convex/shared/lib/result";
import type { SessionAvailabilityValidationError } from "#convex/sessions/lib/calendarTime";
import type {
	BuildSessionCheckoutLineItemsInput,
	PackageCheckoutDiscount,
	SessionCheckoutLineItem
} from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";

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

export function createPendingSessionForCheckout(
	ctx: ActionCtx,
	booking: SessionCheckoutBooking
): ResultAsync<{ bookingId: Id<"bookings"> }, SessionAvailabilityValidationError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.checkout.createPendingSession, {
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

export function createStripeCheckoutCustomer<
	T extends {
		lineItems: SessionCheckoutLineItem[];
		bookingId?: Id<"bookings">;
		packageId?: Id<"packages">;
	}
>(
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
			const failure = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" } as const;

			logError(
				{
					operation: "stripe.checkout.customer.create",
					...failure,
					bookingId: checkoutDraft.bookingId,
					packageId: checkoutDraft.packageId
				},
				cause
			);

			return failure;
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
			const failure = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" } as const;

			logError(
				{
					operation: "stripe.checkout.session.create",
					...failure,
					bookingId: checkoutDraft.bookingId
				},
				cause
			);

			return failure;
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

	return fromConvexTuple(
		ctx.runMutation(internal.sessions.checkout.setSessionStripeSessionId, {
			bookingId: checkoutDraft.bookingId,
			stripeSessionId: checkoutDraft.session.id,
			stripeCustomerId: checkoutDraft.stripeCustomerId
		})
	).map(() => ({
		bookingId: checkoutDraft.bookingId,
		clientSecret,
		stripeSessionId: checkoutDraft.session.id
	}));
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
			const failure = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" } as const;

			logError({ operation: "stripe.checkout.coupon.create", ...failure }, cause);

			return failure;
		}
	});
}

export function createEmbeddedStripePackageCheckoutSession(
	stripe: Stripe,
	checkoutDraft: PackageCheckoutDraft & { stripeCustomerId: string; couponId: string }
): ResultAsync<StripePackageCheckoutDraft, StripeCheckoutCreateFailed> {
	return tryPromise({
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
					discounts: [{ coupon: checkoutDraft.couponId }],
					payment_intent_data: { description: "Package booking" }
				})
				.then((session) => ({
					packageId: checkoutDraft.packageId,
					lineItems: checkoutDraft.lineItems,
					discount: checkoutDraft.discount,
					stripeCustomerId: checkoutDraft.stripeCustomerId,
					session
				})),
		catch: (cause) => {
			const failure = { reason: "STRIPE_CHECKOUT_CREATE_FAILED" } as const;

			logError(
				{
					operation: "stripe.packageCheckout.session.create",
					...failure,
					packageId: checkoutDraft.packageId
				},
				cause
			);

			return failure;
		}
	});
}

type StripeCheckoutCloseArgs = {
	stripeSessionId: string;
	bookingId?: Id<"bookings">;
	packageId?: Id<"packages">;
};

export function closeOpenStripeCheckoutSession(
	stripe: Stripe,
	args: StripeCheckoutCloseArgs
): ResultAsync<Stripe.Checkout.Session, StripeCheckoutCloseFailed> {
	return tryPromise({
		try: async () => {
			const session = await stripe.checkout.sessions.retrieve(args.stripeSessionId);

			if (session.status === "open") {
				await stripe.checkout.sessions.expire(args.stripeSessionId);
			}

			return session;
		},
		catch: (cause) => {
			const failure = { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" } as const;

			logError(
				{
					operation: "stripe.checkout.session.close",
					stripeSessionId: args.stripeSessionId,
					bookingId: args.bookingId,
					packageId: args.packageId,
					...failure
				},
				cause
			);

			return failure;
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

	return fromConvexTuple(
		ctx.runMutation(internal.packages.checkout.setPackageStripeSessionId, {
			packageId: checkoutDraft.packageId,
			stripeSessionId: checkoutDraft.session.id,
			stripeCustomerId: checkoutDraft.stripeCustomerId
		})
	).map(() => ({
		packageId: checkoutDraft.packageId,
		clientSecret,
		stripeSessionId: checkoutDraft.session.id
	}));
}
