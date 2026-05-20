import { ConvexError, v } from "convex/values";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	type BookingAvailabilitySettings,
} from "../../src/sites/studio/lib/bookingAvailabilitySettings";

export type BookingSettingsArgs = BookingAvailabilitySettings;

export const DEFAULT_BOOKING_SETTINGS = DEFAULT_BOOKING_AVAILABILITY_SETTINGS;

const dayScheduleValidator = v.object({
	endTime: v.string(),
	startTime: v.string(),
});

export const bookingSettingsArgs = {
	eventBufferMinutes: v.number(),
	leadTimeMinutes: v.number(),
	maxDaysAhead: v.number(),
	weekSchedule: v.array(dayScheduleValidator),
};

type BookingSettingsErrorData = {
	code: "INVALID_BOOKING_SETTINGS" | "NOT_AUTHENTICATED";
};

export function assertAuthenticated(identity: unknown) {
	if (!identity) {
		throw new ConvexError<BookingSettingsErrorData>({ code: "NOT_AUTHENTICATED" });
	}
}

function isValidTime(value: string) {
	return /^([01]\d|2[0-3]):(00|30)$/.test(value);
}

export function validateBookingSettings(args: BookingSettingsArgs) {
	if (
		args.weekSchedule.length !== 7 ||
		args.leadTimeMinutes < 0 ||
		args.eventBufferMinutes < 0 ||
		args.maxDaysAhead < 1
	) {
		throw new ConvexError<BookingSettingsErrorData>({ code: "INVALID_BOOKING_SETTINGS" });
	}

	for (const schedule of Object.values(args.weekSchedule)) {
		if (!isValidTime(schedule.startTime) || !isValidTime(schedule.endTime)) {
			throw new ConvexError<BookingSettingsErrorData>({ code: "INVALID_BOOKING_SETTINGS" });
		}
	}
}
