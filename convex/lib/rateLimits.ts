import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { err, ok } from "#/lib/result";
import { components } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	bookingSubmit: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 10 },
	bookingSubmitGlobal: { kind: "fixed window", rate: 50, period: 15 * MINUTE },
	googleCalendarAvailability: { kind: "fixed window", rate: 8, period: MINUTE },
	googleCalendarAvailabilityGlobal: { kind: "fixed window", rate: 100, period: 5 * MINUTE },
	feedbackSubmitGlobal: { kind: "fixed window", rate: 25, period: 15 * MINUTE }
});

type RateLimitCtx = ActionCtx | MutationCtx;

export type BookingSubmitRateLimitError = { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number };

export async function checkGoogleCalendarAvailabilityRateLimit(ctx: ActionCtx, key: string) {
	const globalRateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailabilityGlobal");
	const rateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailability", { key });

	if (!globalRateLimitStatus.ok || !rateLimitStatus.ok) {
		return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });
	}

	return ok({ limited: false });
}

export async function checkBookingSubmitRateLimit(ctx: RateLimitCtx, key: string) {
	const globalRateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmitGlobal");
	const rateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmit", { key });

	if (!globalRateLimitStatus.ok) {
		return err({ reason: "BOOKING_RATE_LIMITED", retryAfter: globalRateLimitStatus.retryAfter });
	}

	if (!rateLimitStatus.ok) {
		return err({ reason: "BOOKING_RATE_LIMITED", retryAfter: rateLimitStatus.retryAfter });
	}

	return ok({ limited: false });
}
