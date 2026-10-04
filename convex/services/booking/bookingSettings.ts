import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import { validateBookingSettings } from "#convex/lib/booking/bookingSettings";
import { okOrThrow } from "#convex/lib/result";

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return okOrThrow(ctx.runQuery(api.bookingSettings.get, {}));
}

export function updateBookingSettingsService(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings
) {
	return requirePermission(ctx, "update:availability")
		.andThen((identity) => validateBookingSettings(settings).map(() => identity))
		.andThen((identity) => {
			const value = {
				...settings,
				key: "main" as const,
				updatedAt: Date.now(),
				updatedBy: identity.email
			};

			return okOrThrow(
				ctx.db
					.query("bookingSettings")
					.withIndex("by_key", (query) => query.eq("key", "main"))
					.unique()
			).andThen((existing) =>
				existing
					? okOrThrow(ctx.db.patch("bookingSettings", existing._id, value).then(() => null))
					: okOrThrow(ctx.db.insert("bookingSettings", value).then(() => null))
			);
		});
}
