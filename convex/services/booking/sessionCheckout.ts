import { ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { patchBookingStripeCheckoutIds } from "#convex/lib/booking/bookingConfirmationSessionPatches";
import { env } from "#convex/env";
import { archiveDeadCheckoutBooking } from "#convex/services/sessions/sessionArchive";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import {
	type DeletePendingSessionDecision,
	type DeletePendingSessionSuccess,
	type ExpireSessionDecision,
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
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return (settings: BookingAvailabilitySettings) =>
		validateCheckoutSessionAvailability(settings, args);
}

function insertPendingCheckoutBookingFields(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number
) {
	return (driveClientId: Id<"driveClients">) => {
		const bookingFields = buildPendingPaymentBookingFields(args, sessionStartAt, driveClientId);

		return insertPendingPaymentBooking(ctx, bookingFields);
	};
}

function resolveCheckoutDriveClientIdStep(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs
) {
	return () => resolveCheckoutDriveClientId(ctx, args);
}

function finishExpirePendingCheckout(ctx: MutationCtx) {
	return (decision: ExpireSessionDecision) => {
		if (decision.kind === "complete") {
			return ok<{ alreadyExpired: boolean }>({ alreadyExpired: decision.alreadyExpired });
		}

		return archiveDeadCheckoutBooking(ctx, decision.bookingId, { status: "expired" }).map(
			expirePendingCheckoutArchived
		);
	};
}

function expirePendingCheckoutArchived() {
	return { alreadyExpired: false as const };
}

function validatePendingSessionDeletionForStripeSession(stripeSessionId: string) {
	return (booking: Doc<"bookings"> | null) =>
		validatePendingSessionDeletion(booking, stripeSessionId);
}

function finishAbandonPendingCheckout(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return (decision: DeletePendingSessionDecision) => {
		if (decision.kind === "complete") {
			return ok(decision.value);
		}

		return archiveDeadCheckoutBooking(ctx, bookingId, { status: "abandoned" }).map(
			abandonPendingCheckoutComplete
		);
	};
}

function abandonPendingCheckoutComplete(): DeletePendingSessionSuccess {
	return { outcome: "abandoned" };
}

export function enforceBookingSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function rejectCheckoutSlotUnavailable(
	ctx: MutationCtx,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return getBookingAvailabilitySettings(ctx).andThen(validateCheckoutAvailabilityForSettings(args));
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
		.andThen(resolveCheckoutDriveClientIdStep(ctx, args))
		.andThen(insertPendingCheckoutBookingFields(ctx, args, sessionStartAt));
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
		.andThen(finishExpirePendingCheckout(ctx));
}

export function abandonPendingCheckoutBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): NeverthrowResultAsync<DeletePendingSessionSuccess, { reason: "STRIPE_SESSION_MISMATCH" }> {
	return getBookingRow(ctx, args.bookingId)
		.andThen(validatePendingSessionDeletionForStripeSession(args.stripeSessionId))
		.andThen(finishAbandonPendingCheckout(ctx, args.bookingId));
}
