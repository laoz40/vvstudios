import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";

import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	buildBookingAvailabilitySettingsRowValue,
	lookupBookingAvailabilitySettingsRow,
	readBookingAvailabilitySettings,
	upsertBookingAvailabilitySettingsRow,
	validateBookingSettings
} from "#convex/booking/lib/settings";

function writeValidatedBookingSettings(
	ctx: MutationCtx,
	value: ReturnType<typeof buildBookingAvailabilitySettingsRowValue>
) {
	return lookupBookingAvailabilitySettingsRow(ctx).andThen((existing) =>
		upsertBookingAvailabilitySettingsRow(ctx, value, existing)
	);
}

export function loadBookingAvailabilitySettings(ctx: QueryCtx) {
	return readBookingAvailabilitySettings(ctx);
}

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return queryBookingAvailabilitySettings(ctx);
}

export function writeBookingAvailabilitySettings(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings,
	updatedBy: string
) {
	const value = buildBookingAvailabilitySettingsRowValue(settings, updatedBy);

	return validateBookingSettings(settings).asyncAndThen(() =>
		writeValidatedBookingSettings(ctx, value)
	);
}
