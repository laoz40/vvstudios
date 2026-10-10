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
} from "#convex/booking/lib/settings";
import { okOrThrow } from "#convex/shared/lib/result";
import type { Doc } from "#convex/_generated/dataModel";

type BookingSettingsRowValue = BookingAvailabilitySettings & {
	key: "main";
	updatedAt: number;
	updatedBy: string;
};

function upsertBookingAvailabilitySettingsRow(
	ctx: MutationCtx,
	value: BookingSettingsRowValue,
	existing: Doc<"bookingSettings"> | null
) {
	return existing
		? patchBookingAvailabilitySettingsRow(ctx, existing._id, value)
		: insertBookingAvailabilitySettingsRow(ctx, value);
}

function writeValidatedBookingSettings(ctx: MutationCtx, value: BookingSettingsRowValue) {
	return lookupBookingAvailabilitySettingsRow(ctx).andThen(
		(existing: Doc<"bookingSettings"> | null) =>
			upsertBookingAvailabilitySettingsRow(ctx, value, existing)
	);
}

function persistValidatedBookingSettings(
	ctx: MutationCtx,
	value: BookingSettingsRowValue,
	_settings: BookingAvailabilitySettings
) {
	return writeValidatedBookingSettings(ctx, value);
}

export function loadBookingAvailabilitySettings(ctx: QueryCtx) {
	return readBookingAvailabilitySettings(ctx);
}

export function getBookingSettingsService(
	ctx: ActionCtx
): NeverthrowResultAsync<BookingAvailabilitySettings, never> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}

export function writeBookingAvailabilitySettings(
	ctx: MutationCtx,
	settings: BookingAvailabilitySettings,
	updatedBy: string
) {
	const value = { ...settings, key: "main" as const, updatedAt: Date.now(), updatedBy };

	return validateBookingSettings(settings).asyncAndThen((_settings: BookingAvailabilitySettings) =>
		persistValidatedBookingSettings(ctx, value, _settings)
	);
}
