import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return okOrThrow(ctx.runQuery(api.bookingSettings.get, {}));
}

export function persistBookingAvailabilitySettings(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings,
	updatedBy: string
) {
	const value = { ...settings, key: "main" as const, updatedAt: Date.now(), updatedBy };

	return okOrThrow(
		ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (indexQuery) => indexQuery.eq("key", "main"))
			.unique()
	).andThen((existing) =>
		existing
			? okOrThrow(ctx.db.patch("bookingSettings", existing._id, value).then(() => null))
			: okOrThrow(ctx.db.insert("bookingSettings", value).then(() => null))
	);
}
