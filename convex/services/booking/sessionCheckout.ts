import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { patchBookingStripeCheckoutIds } from "#convex/lib/booking/bookingConfirmationSessionPatches";
import { env } from "#convex/env";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import {
	abandonBookingAfterValidate,
	expireBookingAfterValidate,
	type DeletePendingSessionSuccess,
	type ExpireSessionError,
	validatePendingSessionDeletion,
	validateSessionExpiry
} from "#convex/lib/sessions/sessionCheckout";
import { getBookingRow, lookupBookingByStripeSessionId } from "#convex/lib/sessions/sessionLookup";
import {
	type CreatePendingCheckoutSessionArgs,
	buildPendingPaymentBookingFields,
	findPendingPaymentBookingAtStartTime,
	insertPendingPaymentBooking,
	rejectPendingPaymentSlotConflict,
	resolveCheckoutDriveClientId,
	validateCheckoutSessionAvailability
} from "#convex/lib/sessions/pendingCheckoutSession";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

function validateCheckoutAvailabilityForSettings(
	settings: BookingAvailabilitySettings,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return validateCheckoutSessionAvailability(settings, args);
}

function insertPendingCheckoutBookingFields(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number,
	driveClientId: Id<"driveClients">
) {
	const bookingFields = buildPendingPaymentBookingFields(args, sessionStartAt, driveClientId);

	return insertPendingPaymentBooking(ctx, bookingFields);
}

function resolveCheckoutDriveClientIdStep(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs
) {
	return resolveCheckoutDriveClientId(ctx, args);
}

export function enforceBookingSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function rejectCheckoutSlotUnavailable(
	ctx: MutationCtx,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return getBookingAvailabilitySettings(ctx).andThen((settings) =>
		validateCheckoutAvailabilityForSettings(settings, args)
	);
}

export function parseCheckoutSessionStartTime(
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "time">
) {
	return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE);
}

export function createPendingCheckoutBooking(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number
) {
	return findPendingPaymentBookingAtStartTime(ctx, sessionStartAt)
		.andThen(rejectPendingPaymentSlotConflict)
		.andThen(() => resolveCheckoutDriveClientIdStep(ctx, args))
		.andThen((driveClientId) =>
			insertPendingCheckoutBookingFields(ctx, args, sessionStartAt, driveClientId)
		);
}

export function loadBookingRowByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId);
}

export function writeBookingStripeCheckoutIds(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string; stripeCustomerId: string }
) {
	return patchBookingStripeCheckoutIds(ctx, args);
}

export function expirePendingCheckoutByStripeSessionId(
	ctx: MutationCtx,
	stripeSessionId: string
): NeverthrowResultAsync<{ alreadyExpired: boolean }, ExpireSessionError> {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId)
		.andThen(validateSessionExpiry)
		.andThen((decision) => expireBookingAfterValidate(ctx, decision));
}

export function abandonPendingCheckoutBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): NeverthrowResultAsync<DeletePendingSessionSuccess, { reason: "STRIPE_SESSION_MISMATCH" }> {
	return getBookingRow(ctx, args.bookingId)
		.andThen((booking) => validatePendingSessionDeletion(booking, args.stripeSessionId))
		.andThen((decision) => abandonBookingAfterValidate(ctx, args.bookingId, decision));
}
