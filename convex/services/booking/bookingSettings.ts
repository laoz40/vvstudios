import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	insertBookingAvailabilitySettingsRow,
	lookupBookingAvailabilitySettingsRow,
	patchBookingAvailabilitySettingsRow,
	readBookingAvailabilitySettings,
	validateBookingSettings
} from "#convex/lib/booking/bookingSettings";
import { okOrThrow } from "#convex/lib/result";

export function loadBookingAvailabilitySettings(ctx: QueryCtx) {
	return readBookingAvailabilitySettings(ctx);
}

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return okOrThrow(ctx.runQuery(api.bookingSettings.get, {}));
}

export function writeBookingAvailabilitySettings(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings,
	updatedBy: string
) {
	const value = { ...settings, key: "main" as const, updatedAt: Date.now(), updatedBy };

	return validateBookingSettings(settings).asyncAndThen(() =>
		lookupBookingAvailabilitySettingsRow(ctx).andThen((existing) =>
			existing
				? patchBookingAvailabilitySettingsRow(ctx, existing._id, value)
				: insertBookingAvailabilitySettingsRow(ctx, value)
		)
	);
}
