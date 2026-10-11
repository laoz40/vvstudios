import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
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
	return limitGoogleCalendarKey(ctx, key).andThen(requireGoogleCalendarLimit);
}

export function checkGoogleCalendarAvailabilityRateLimit(ctx: ActionCtx, key: string) {
	return limitGoogleCalendarGlobal(ctx)
		.andThen(requireGoogleCalendarLimit)
		.andThen(() => checkGoogleCalendarKey(ctx, key));
}

export function checkFeedbackSubmitRateLimit(ctx: ActionCtx) {
	return limitFeedbackGlobal(ctx).andThen(requireFeedbackLimit);
}

function checkBookingKey(ctx: ActionCtx | MutationCtx, key: string) {
	return limitBookingKey(ctx, key).andThen(requireBookingLimit);
}

export function checkBookingSubmitRateLimit(ctx: ActionCtx | MutationCtx, key: string) {
	return limitBookingGlobal(ctx)
		.andThen(requireBookingLimit)
		.andThen(() => checkBookingKey(ctx, key));
}
