import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { ok, safeTry, type ResultAsync as NeverthrowResultAsync } from "neverthrow";

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
	return safeTry(async function* () {
		const existing = yield* lookupBookingAvailabilitySettingsRow(ctx);
		const result = yield* upsertBookingAvailabilitySettingsRow(ctx, value, existing);

		return ok(result);
	});
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

	return safeTry(async function* () {
		yield* validateBookingSettings(settings);
		const result = yield* writeValidatedBookingSettings(ctx, value);

		return ok(result);
	});
}
