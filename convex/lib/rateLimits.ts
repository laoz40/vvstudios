import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { err, ok } from "neverthrow";
import { components } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	bookingSubmit: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 10 },
	bookingSubmitGlobal: { kind: "fixed window", rate: 50, period: 15 * MINUTE },
	googleCalendarAvailability: { kind: "fixed window", rate: 8, period: MINUTE },
	googleCalendarAvailabilityGlobal: { kind: "fixed window", rate: 100, period: 5 * MINUTE },
	feedbackSubmitGlobal: { kind: "fixed window", rate: 25, period: 15 * MINUTE }
});

type RateLimitCtx = ActionCtx | MutationCtx;

export type BookingSubmitRateLimitError = { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number };

export function checkGoogleCalendarAvailabilityRateLimit(ctx: ActionCtx, key: string) {
	return okOrThrow(rateLimiter.limit(ctx, "googleCalendarAvailabilityGlobal")).andThen(
		(globalRateLimitStatus) => {
			if (!globalRateLimitStatus.ok) {
				return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" as const });
			}

			return okOrThrow(
				rateLimiter.limit(ctx, "googleCalendarAvailability", { key })
			).andThen((rateLimitStatus) =>
				rateLimitStatus.ok
					? ok(null)
					: err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" as const })
			);
		}
	);
}

export function checkBookingSubmitRateLimit(ctx: RateLimitCtx, key: string) {
	return okOrThrow(rateLimiter.limit(ctx, "bookingSubmitGlobal")).andThen(
		(globalRateLimitStatus) => {
			if (!globalRateLimitStatus.ok) {
				return err({
					reason: "BOOKING_RATE_LIMITED" as const,
					retryAfter: globalRateLimitStatus.retryAfter
				});
			}

			return okOrThrow(rateLimiter.limit(ctx, "bookingSubmit", { key })).andThen(
				(rateLimitStatus) => {
					if (!rateLimitStatus.ok) {
						return err({
							reason: "BOOKING_RATE_LIMITED" as const,
							retryAfter: rateLimitStatus.retryAfter
						});
					}

					return ok(null);
				}
			);
		}
	);
}
