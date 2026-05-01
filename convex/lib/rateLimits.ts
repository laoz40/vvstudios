import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	bookingSubmit: {
		kind: "token bucket",
		rate: 1,
		period: MINUTE,
		capacity: 10,
	},
	bookingSubmitGlobal: {
		kind: "fixed window",
		rate: 50,
		period: 15 * MINUTE,
	},
});
