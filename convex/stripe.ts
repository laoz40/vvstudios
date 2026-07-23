"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { bookingSchema } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import { err, ok, type Result } from "../src/lib/result";
import { env } from "./env";
import { emailDomainCanReceiveMail, getBookingSubmitRateLimitKey } from "./lib/bookingSubmission";
import type { SessionAvailabilityValidationError } from "./lib/sessionCalendarTime";

function getStripeClient() {
	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
}

type PendingBookingCreationResult = Result<
	{ bookingId: Id<"bookings"> },
	SessionAvailabilityValidationError
>;

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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: (ctx, args) => createEmbeddedCheckoutSessionHandler(ctx, args)
});

// Creates a pending booking, opens a Stripe checkout session, then links both records.
async function createEmbeddedCheckoutSessionHandler(
	ctx: ActionCtx,
	args: {
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
		essentialEditQuantity?: string;
		clipsPackageQuantity?: string;
		notes?: string;
	}
): Promise<
	Result<
		{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
		| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
		| { reason: "BOOKING_INVALID_INPUT" }
		| { reason: "BOOKING_INVALID_DATE" }
		| { reason: "BOOKING_INVALID_DURATION" }
		| { reason: "BOOKING_INVALID_TIME" }
		| { reason: "BOOKING_OUTSIDE_OPENING_HOURS" }
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
		| { reason: "BOOKING_TIME_UNAVAILABLE" }
		| { reason: "BOOKING_TOO_FAR_AHEAD" }
		| { reason: "BOOKING_TOO_SOON" }
		| { reason: "STRIPE_SESSION_LINK_FAILED" }
	>
> {
	// Validate the single-session form before creating anything in Convex or Stripe.
	const parsedBooking = bookingSchema.safeParse({
		...args,
		bookingMode: "single",
		packageSize: ""
	});

	if (!parsedBooking.success) {
		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	const booking = parsedBooking.data;
	const [rateLimitError] = await ctx.runMutation(
		internal.sessionCheckout.checkSessionSubmitRateLimit,
		{ submitRateLimitKey: getBookingSubmitRateLimitKey(booking.email) }
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	// Reject emails whose domain has no mail records, so customers can receive booking emails.
	const isValidEmailDomain = await emailDomainCanReceiveMail(booking.email);

	if (!isValidEmailDomain) {
		return err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" });
	}
	const stripe = getStripeClient();
	// Save the booking first so Stripe metadata can point back to it.
	const pendingBookingResult: PendingBookingCreationResult = await ctx.runMutation(
		internal.sessionCheckout.createPendingSession,
		{
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
			clipsPackageQuantity: booking.clipsPackageQuantity || undefined,
			notes: booking.notes || undefined
		}
	);
	// Some booking rules are checked inside createPendingSession, such as time availability.

	// Stop before Stripe checkout if creating the pending booking failed.
	const [pendingBookingError, pendingBooking] = pendingBookingResult;

	if (pendingBookingError !== null) {
		return err(pendingBookingError);
	}

	// Create the embedded Stripe checkout session for the deposit and processing fee.
	const bookingId = pendingBooking.bookingId;
	const session = await stripe.checkout.sessions.create({
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
	});

	// Stripe should always return this for embedded checkout. If not, something is broken.
	if (!session.client_secret) {
		throw new Error("Stripe checkout session missing client secret");
	}

	// Store the Stripe session ID so webhooks and cleanup can match the payment to this booking.
	try {
		await ctx.runMutation(internal.sessionCheckout.setSessionStripeSessionId, {
			bookingId,
			stripeSessionId: session.id
		});
	} catch {
		return err({ reason: "STRIPE_SESSION_LINK_FAILED" });
	}

	return ok({ bookingId, clientSecret: session.client_secret, stripeSessionId: session.id });
}

export type CreateEmbeddedCheckoutSessionResult = Awaited<
	ReturnType<typeof createEmbeddedCheckoutSessionHandler>
>;

export const closeEmbeddedCheckoutSession = action({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) => closeEmbeddedCheckoutSessionHandler(ctx, args)
});

async function closeEmbeddedCheckoutSessionHandler(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): Promise<
	Result<
		{ outcome: "already_complete" | "abandoned" | "not_found" | "not_pending" },
		{ reason: "STRIPE_CHECKOUT_CLOSE_FAILED" } | { reason: "STRIPE_SESSION_MISMATCH" }
	>
> {
	const stripe = getStripeClient();
	let session: Stripe.Checkout.Session;

	try {
		session = await stripe.checkout.sessions.retrieve(args.stripeSessionId);

		if (session.status === "open") {
			await stripe.checkout.sessions.expire(args.stripeSessionId);
		}
	} catch {
		return err({ reason: "STRIPE_CHECKOUT_CLOSE_FAILED" });
	}

	if (session.status === "complete") {
		return ok({ outcome: "already_complete" });
	}

	const [deletePendingSessionError, deletePendingSession] = await ctx.runMutation(
		internal.sessionCheckout.deletePendingSession,
		{ bookingId: args.bookingId, stripeSessionId: args.stripeSessionId }
	);

	if (deletePendingSessionError !== null) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" });
	}

	return ok({ outcome: deletePendingSession.outcome });
}

export type CloseEmbeddedCheckoutSessionResult = Awaited<
	ReturnType<typeof closeEmbeddedCheckoutSessionHandler>
>;
