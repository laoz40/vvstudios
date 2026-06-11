"use node";

import { createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { bookingSchema } from "../src/sites/studio/features/booking-form/lib/form-shared";
import { err, ok, type Result } from "../src/lib/result";
import { env } from "./env";

function getStripeClient() {
	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
}

function getBookingSubmitRateLimitKey(email: string) {
	return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

async function emailDomainCanReceiveMail(email: string) {
	const domain = email.trim().toLowerCase().split("@").at(-1);

	if (!domain) {
		return false;
	}

	try {
		const mxRecords = await resolveMx(domain);
		return mxRecords.length > 0;
	} catch {
		return false;
	}
}

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
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter: number }
		| { reason: "BOOKING_TIME_UNAVAILABLE" }
	>
> {
	// Validate the submitted form before creating anything in Convex or Stripe.
	const parsedBooking = bookingSchema.safeParse(args);

	if (!parsedBooking.success) {
		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	// Reject emails whose domain has no mail records, so customers can receive booking emails.
	const booking = parsedBooking.data;
	const isValidEmailDomain = await emailDomainCanReceiveMail(booking.email);

	if (!isValidEmailDomain) {
		return err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" });
	}

	const stripe = getStripeClient();
	let pendingBookingResult:
		| { ok: true; bookingId: Id<"bookings"> }
		| { ok: false; code: "BOOKING_RATE_LIMITED"; retryAfter: number };

	// Save the booking first so Stripe metadata can point back to it.
	try {
		pendingBookingResult = await ctx.runMutation(internal.bookings.createPendingBooking, {
			submitRateLimitKey: getBookingSubmitRateLimitKey(booking.email),
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
		});
		// Some booking rules are checked inside createPendingBooking, such as time availability.
	} catch (error) {
		if (typeof error !== "object" || error === null || !("data" in error)) {
			return err({ reason: "BOOKING_INVALID_INPUT" });
		}

		const data = error.data;

		if (typeof data !== "object" || data === null || !("code" in data)) {
			return err({ reason: "BOOKING_INVALID_INPUT" });
		}

		if (data.code === "BOOKING_TIME_UNAVAILABLE") {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	// Stop before Stripe checkout if the booking submit rate limit was hit.
	if (!pendingBookingResult.ok) {
		return err({ reason: pendingBookingResult.code, retryAfter: pendingBookingResult.retryAfter });
	}

	// Create the embedded Stripe checkout session for the deposit and processing fee.
	const bookingId = pendingBookingResult.bookingId;
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
	await ctx.runMutation(internal.bookings.setBookingStripeSessionId, {
		bookingId,
		stripeSessionId: session.id
	});

	return ok({ bookingId, clientSecret: session.client_secret, stripeSessionId: session.id });
}

export type CreateEmbeddedCheckoutSessionResult = Awaited<
	ReturnType<typeof createEmbeddedCheckoutSessionHandler>
>;

export const closeEmbeddedCheckoutSession = action({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (
		ctx,
		args
	): Promise<{
		ok: true;
		outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
	}> => {
		const stripe = getStripeClient();
		const session = await stripe.checkout.sessions.retrieve(args.stripeSessionId);

		if (session.status === "complete") {
			return { ok: true as const, outcome: "already_complete" as const };
		}

		if (session.status === "open") {
			await stripe.checkout.sessions.expire(args.stripeSessionId);
		}

		const result:
			| { ok: true; outcome: "abandoned" | "not_found" | "not_pending" }
			| { ok: false; reason: "stripe_session_mismatch" } = await ctx.runMutation(
			internal.bookings.deletePendingBooking,
			{ bookingId: args.bookingId, stripeSessionId: args.stripeSessionId }
		);

		if (!result.ok) {
			throw new Error(result.reason);
		}

		return { ok: true as const, outcome: result.outcome };
	}
});
