import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { err, ok } from "neverthrow";
import { components } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	bookingSubmit: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 10 },
	bookingSubmitGlobal: { kind: "fixed window", rate: 50, period: 15 * MINUTE },
	googleCalendarAvailability: { kind: "fixed window", rate: 8, period: MINUTE },
	googleCalendarAvailabilityGlobal: { kind: "fixed window", rate: 100, period: 5 * MINUTE },
	feedbackSubmitGlobal: { kind: "fixed window", rate: 25, period: 15 * MINUTE }
});

type RateLimitCtx = ActionCtx | MutationCtx;

export type BookingSubmitRateLimitError = { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number };

export function limitGoogleCalendarGlobal(ctx: ActionCtx) {
	return okOrThrow(rateLimiter.limit(ctx, "googleCalendarAvailabilityGlobal"));
}

export function limitGoogleCalendarKey(ctx: ActionCtx, key: string) {
	return okOrThrow(rateLimiter.limit(ctx, "googleCalendarAvailability", { key }));
}

export function limitFeedbackGlobal(ctx: ActionCtx) {
	return okOrThrow(rateLimiter.limit(ctx, "feedbackSubmitGlobal"));
}

export function limitBookingGlobal(ctx: RateLimitCtx) {
	return okOrThrow(rateLimiter.limit(ctx, "bookingSubmitGlobal"));
}

export function limitBookingKey(ctx: RateLimitCtx, key: string) {
	return okOrThrow(rateLimiter.limit(ctx, "bookingSubmit", { key }));
}

type RateLimitStatus = { ok: boolean; retryAfter?: number };

export function requireGoogleCalendarLimit(status: RateLimitStatus) {
	return status.ok ? ok(null) : err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" as const });
}

export function requireFeedbackLimit(status: RateLimitStatus) {
	return status.ok ? ok(null) : err({ reason: "FEEDBACK_RATE_LIMITED" as const });
}

export function requireBookingLimit(status: RateLimitStatus) {
	return status.ok
		? ok(null)
		: err({ reason: "BOOKING_RATE_LIMITED" as const, retryAfter: status.retryAfter });
}
