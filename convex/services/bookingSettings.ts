import type { BookingAvailabilitySettings } from "../../src/sites/studio/lib/bookingAvailabilitySettings";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { validateBookingSettingsResult } from "../lib/bookingSettings";
import { nullResult } from "../lib/result";

export function updateBookingSettingsService(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings
) {
	return getAdminIdentityResult(ctx)
		.andThen((identity) => validateBookingSettingsResult(settings).map(() => identity))
		.andThen((identity) =>
			nullResult(
				(async () => {
					const existing = await ctx.db
						.query("bookingSettings")
						.withIndex("by_key", (query) => query.eq("key", "main"))
						.unique();

					const value = {
						...settings,
						key: "main",
						updatedAt: Date.now(),
						updatedBy: identity.email
					};

					if (existing) {
						await ctx.db.patch(existing._id, value);
						return;
					}

					await ctx.db.insert("bookingSettings", value);
				})()
			)
		);
}
