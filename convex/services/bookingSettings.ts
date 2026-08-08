import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import { validateBookingSettings } from "#convex/lib/bookingSettings";
import { okOrThrow } from "#convex/lib/result";

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return ResultAsync.fromSafePromise<BookingAvailabilitySettings>(
		ctx.runQuery(api.bookingSettings.get, {})
	);
}

export function updateBookingSettingsService(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings
) {
	return requirePermission(ctx, "update:availability")
		.andThen((identity) => validateBookingSettings(settings).map(() => identity))
		.andThen((identity) =>
			okOrThrow(
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
