"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import type { BookingAddon } from "#/domain/booking/catalog";

import { fromConvexTuple } from "#convex/shared/lib/result";

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

export function enforceSessionSubmitRateLimit(
	ctx: ActionCtx,
	booking: BookingFormValues,
	submitRateLimitKey: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.checkout.checkSessionSubmitRateLimit, { submitRateLimitKey })
	).map(() => booking);
}

export function deletePendingSessionAfterClose(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.checkout.deletePendingSession, args)
	).map(({ outcome }) => ({ outcome }));
}

export function resolveClosedBookingCheckoutSession(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string },

	session: Stripe.Checkout.Session
) {
	if (session.status === "complete") {
		return okAsync({ outcome: "already_complete" as const });
	}

	return deletePendingSessionAfterClose(ctx, args);
}

export function parsePublicCheckoutBooking(
	args: CreateEmbeddedCheckoutSessionArgs
): ResultAsync<BookingFormValues, { reason: "BOOKING_INVALID_INPUT" }> {
	const parsed = publicBookingSchema.safeParse({ ...args, bookingMode: "single", packageSize: "" });

	return parsed.success ? okAsync(parsed.data) : errAsync({ reason: "BOOKING_INVALID_INPUT" });
}
