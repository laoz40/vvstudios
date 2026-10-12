import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { ok, safeTry } from "neverthrow";
import {
	limitGoogleCalendarGlobal,
	limitGoogleCalendarKey,
	limitFeedbackGlobal,
	limitBookingGlobal,
	limitBookingKey,
	requireGoogleCalendarLimit,
	requireFeedbackLimit,
	requireBookingLimit
} from "#convex/shared/lib/rateLimits";

function checkGoogleCalendarKey(ctx: ActionCtx, key: string) {
	return safeTry(async function* () {
		const limit = yield* limitGoogleCalendarKey(ctx, key);
		yield* requireGoogleCalendarLimit(limit);

		return ok(null);
	});
}

export function checkGoogleCalendarAvailabilityRateLimit(ctx: ActionCtx, key: string) {
	return safeTry(async function* () {
		const limit = yield* limitGoogleCalendarGlobal(ctx);
		yield* requireGoogleCalendarLimit(limit);
		yield* checkGoogleCalendarKey(ctx, key);

		return ok(null);
	});
}

export function checkFeedbackSubmitRateLimit(ctx: ActionCtx) {
	return safeTry(async function* () {
		const limit = yield* limitFeedbackGlobal(ctx);
		yield* requireFeedbackLimit(limit);

		return ok(null);
	});
}

function checkBookingKey(ctx: ActionCtx | MutationCtx, key: string) {
	return safeTry(async function* () {
		const limit = yield* limitBookingKey(ctx, key);
		yield* requireBookingLimit(limit);

		return ok(null);
	});
}

export function checkBookingSubmitRateLimit(ctx: ActionCtx | MutationCtx, key: string) {
	return safeTry(async function* () {
		const limit = yield* limitBookingGlobal(ctx);
		yield* requireBookingLimit(limit);
		yield* checkBookingKey(ctx, key);

		return ok(null);
	});
}
