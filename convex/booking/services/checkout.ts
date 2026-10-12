import { ok, safeTry, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { getOrCreateDriveClientId } from "#convex/drive/services/setup";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	abandonBookingAfterValidate,
	buildCheckoutDriveClientInput,
	expireBookingAfterValidate,
	insertPendingCheckoutBookingFields,
	validatePendingSessionDeletionWithBooking,
	validateSessionExpiryWithBooking
} from "#convex/booking/lib/checkout";
import { patchBookingStripeCheckoutIds } from "#convex/booking/lib/confirmationSessionPatches";
import { env } from "#convex/env";
import { getSessionStartAt } from "#convex/sessions/lib/adminEdit";
import type {
	DeletePendingSessionSuccess,
	ExpireSessionError
} from "#convex/sessions/lib/checkout";
import { getBookingRow, lookupBookingByStripeSessionId } from "#convex/sessions/lib/lookup";
import {
	type CreatePendingCheckoutSessionArgs,
	findPendingPaymentBookingAtStartTime,
	rejectPendingPaymentSlotConflict
} from "#convex/sessions/lib/pendingCheckoutSession";
import { getBookingAvailabilitySettings } from "#convex/booking/lib/settings";
import { checkBookingSubmitRateLimit } from "#convex/shared/services/rateLimits";
import { checkSessionMeetsAvailabilitySettings } from "#convex/sessions/services/calendarTime";

export function enforceBookingSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function rejectCheckoutSlotUnavailable(
	ctx: MutationCtx,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return safeTry(async function* () {
		const settings = yield* getBookingAvailabilitySettings(ctx);

		const availability = yield* checkSessionMeetsAvailabilitySettings({
			...args,
			settings,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE
		});

		return ok(availability);
	});
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
	return safeTry(async function* () {
		const pendingBooking = yield* findPendingPaymentBookingAtStartTime(ctx, sessionStartAt);
		yield* rejectPendingPaymentSlotConflict(pendingBooking);
		const driveClientId = yield* getOrCreateDriveClientId(ctx, buildCheckoutDriveClientInput(args));

		const booking = yield* insertPendingCheckoutBookingFields(
			ctx,
			args,
			sessionStartAt,
			driveClientId
		);

		return ok(booking);
	});
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
	return safeTry(async function* () {
		const booking = yield* lookupBookingByStripeSessionId(ctx, stripeSessionId);
		const validatedExpiry = yield* validateSessionExpiryWithBooking(booking);
		const result = yield* expireBookingAfterValidate(ctx, validatedExpiry);

		return ok(result);
	});
}

export function abandonPendingCheckoutBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): NeverthrowResultAsync<DeletePendingSessionSuccess, { reason: "STRIPE_SESSION_MISMATCH" }> {
	return safeTry(async function* () {
		const booking = yield* getBookingRow(ctx, args.bookingId);

		const deletion = yield* validatePendingSessionDeletionWithBooking(
			booking,
			args.stripeSessionId
		);

		const result = yield* abandonBookingAfterValidate(ctx, args.bookingId, deletion);

		return ok(result);
	});
}
