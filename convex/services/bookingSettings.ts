import { ResultAsync } from "neverthrow";
import type { BookingAvailabilitySettings } from "../../src/sites/studio/lib/bookingAvailabilitySettings";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { validateBookingSettingsResult } from "../lib/bookingSettings";

export function updateBookingSettingsService(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings
) {
	return getAdminIdentityResult(ctx)
		.andThen((identity) => validateBookingSettingsResult(settings).map(() => identity))
		.andThen((identity) =>
			ResultAsync.fromSafePromise(
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
						return null;
					}

					await ctx.db.insert("bookingSettings", value);
					return null;
				})()
			)
		);
}
