import { err, ok, type Result } from "../../src/lib/result";
import { isTimeSlotAvailable } from "./bookingCalendarTime";
import { getBusyWindows } from "./googleCalendarAvailability";
import { getGoogleCalendarClient } from "./googleCalendarClient";
import { getGoogleCalendarErrorCode } from "./googleCalendarErrors";
import {
	createBookingCalendarEvent,
	updateBookingCalendarEventTiming,
	type BookingCalendarEventDetails,
	type BookingCalendarEventRecord
} from "./googleCalendarEvents";

export type PackageCalendarDetails = BookingCalendarEventDetails & {
	date: string;
	eventBufferMinutes: number;
	time: string;
};

type PackageCalendarClient = Pick<
	ReturnType<typeof getGoogleCalendarClient>,
	"calendar" | "calendarId" | "timeZone"
>;

type PackageCalendarWriteError =
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "GOOGLE_CALENDAR_SYNC_FAILED" };

export async function savePackageBookingCalendarEvent(args: {
	booking: BookingCalendarEventRecord | null;
	details: PackageCalendarDetails;
}): Promise<
	Result<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError>
> {
	try {
		const { calendar, calendarId, calendarIds, timeZone } = getGoogleCalendarClient();
		const ignoredEvent = args.booking
			? { calendarId: args.booking.googleCalendarId, eventId: args.booking.googleEventId }
			: undefined;
		const busyWindows = await getBusyWindows({
			calendar,
			calendarIds,
			date: args.details.date,
			ignoredEvent,
			timeZone
		});
		const isAvailable = isTimeSlotAvailable({
			busyWindows,
			date: args.details.date,
			duration: args.details.duration,
			eventBufferMinutes: args.details.eventBufferMinutes,
			time: args.details.time,
			timeZone
		});

		if (!isAvailable) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		const calendarClient = { calendar, calendarId, timeZone };
		const eventDetails = {
			addons: args.details.addons,
			duration: args.details.duration,
			email: args.details.email,
			name: args.details.name,
			service: args.details.service
		};

		if (args.booking) {
			return await updatePackageCalendarEvent(
				calendarClient,
				args.booking,
				args.details,
				eventDetails
			);
		}

		return await createPackageCalendarEvent(calendarClient, args.details, eventDetails);
	} catch (error) {
		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_SYNC_FAILED") });
	}
}

async function updatePackageCalendarEvent(
	client: PackageCalendarClient,
	booking: BookingCalendarEventRecord,
	details: PackageCalendarDetails,
	eventDetails: BookingCalendarEventDetails
) {
	const [updateError, updateResult] = await updateBookingCalendarEventTiming({
		booking,
		client,
		createMissingEvent: true,
		date: details.date,
		details: eventDetails,
		time: details.time
	});

	if (updateError !== null) {
		return err({ reason: getPackageCalendarSyncErrorReason(updateError.reason) });
	}

	const googleCalendarId = updateResult.googleCalendarId ?? booking.googleCalendarId;
	const googleEventId = updateResult.googleEventId ?? booking.googleEventId;

	return ok({
		...(googleCalendarId ? { googleCalendarId } : {}),
		...(googleEventId ? { googleEventId } : {})
	});
}

async function createPackageCalendarEvent(
	client: PackageCalendarClient,
	details: PackageCalendarDetails,
	eventDetails: BookingCalendarEventDetails
) {
	const [createError, createResult] = await createBookingCalendarEvent({
		client,
		date: details.date,
		details: eventDetails,
		time: details.time
	});

	if (createError !== null) {
		return err({ reason: getPackageCalendarSyncErrorReason(createError.reason) });
	}

	return ok({
		...(createResult.googleCalendarId ? { googleCalendarId: createResult.googleCalendarId } : {}),
		...(createResult.googleEventId ? { googleEventId: createResult.googleEventId } : {})
	});
}

function getPackageCalendarSyncErrorReason(
	reason: string
): "GOOGLE_CALENDAR_AUTH_FAILED" | "GOOGLE_CALENDAR_RATE_LIMITED" | "GOOGLE_CALENDAR_SYNC_FAILED" {
	if (reason === "GOOGLE_CALENDAR_AUTH_FAILED") {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	if (reason === "GOOGLE_CALENDAR_RATE_LIMITED") {
		return "GOOGLE_CALENDAR_RATE_LIMITED";
	}

	return "GOOGLE_CALENDAR_SYNC_FAILED";
}
