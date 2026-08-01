import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { err, ok, ResultAsync } from "neverthrow";
import { err as tupleErr, ok as tupleOk } from "#/lib/result";
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
	return await checkGoogleCalendarAvailabilityRateLimitResult(ctx, key).match(tupleOk, tupleErr);
}

export function checkGoogleCalendarAvailabilityRateLimitResult(ctx: ActionCtx, key: string) {
	return ResultAsync.fromSafePromise(
		Promise.all([
			rateLimiter.limit(ctx, "googleCalendarAvailabilityGlobal"),
			rateLimiter.limit(ctx, "googleCalendarAvailability", { key })
		])
	).andThen(([globalRateLimitStatus, rateLimitStatus]) => {
		if (!globalRateLimitStatus.ok || !rateLimitStatus.ok) {
			return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" as const });
		}

		return ok(null);
	});
}

export async function checkBookingSubmitRateLimit(ctx: RateLimitCtx, key: string) {
	const globalRateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmitGlobal");
	const rateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmit", { key });

	if (!globalRateLimitStatus.ok) {
		return tupleErr({
			reason: "BOOKING_RATE_LIMITED",
			retryAfter: globalRateLimitStatus.retryAfter
		});
	}

	if (!rateLimitStatus.ok) {
		return tupleErr({ reason: "BOOKING_RATE_LIMITED", retryAfter: rateLimitStatus.retryAfter });
	}

	return tupleOk({ limited: false });
}
