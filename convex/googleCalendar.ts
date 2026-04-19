"use node";

import { ConvexError, v } from "convex/values";
import { google } from "googleapis";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { env } from "./env";
import {
	buildEventWindow,
	getAvailableTimeOptions,
	getMonthAvailabilityRange,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
} from "./lib/bookingTimeUtils";
import {
	getGoogleCalendarErrorCode,
	getGoogleCalendarErrorDetails,
} from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";

type BookingCalendarErrorCode =
	| "BOOKING_INVALID_DATE"
	| "BOOKING_INVALID_DURATION"
	| "BOOKING_INVALID_TIME"
	| "BOOKING_STORE_FAILED"
	| "BOOKING_TIME_UNAVAILABLE"
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED";

type BookingCalendarErrorData = {
	code: BookingCalendarErrorCode;
};

interface AvailableBookingTimesResult {
	timeZone: string;
	times: string[];
}

interface CreateBookingWithCalendarEventResult {
	bookingId: Id<"bookings">;
	googleEventId: string | null;
	htmlLink: string | null;
}

interface MonthlyBusyWindowsResult {
	busyWindows: Array<{
		busyPeriods: Array<{ end: string; start: string }>;
		date: string;
		label: string;
	}>;
	month: string;
	timeZone: string;
}

function createBookingCalendarError(code: BookingCalendarErrorCode) {
	return new ConvexError<BookingCalendarErrorData>({ code });
}

function getGoogleCalendarClient() {
	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const refreshToken = env.GOOGLE_REFRESH_TOKEN;
	const calendarId = env.GOOGLE_CALENDAR_ID ?? "primary";
	const timeZone = env.GOOGLE_CALENDAR_TIMEZONE ?? "Australia/Sydney";

	const oauth2Client = new google.auth.OAuth2({
		clientId,
		clientSecret,
	});
	oauth2Client.setCredentials({ refresh_token: refreshToken });

	return {
		calendarId,
		timeZone,
		calendar: google.calendar({ version: "v3", auth: oauth2Client }),
	};
}

export const getMonthlyBusyWindows = action({
	args: {
		month: v.string(),
	},
	handler: async (_ctx, args): Promise<MonthlyBusyWindowsResult> => {
		try {
			const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
			const { timeMin, timeMax } = getMonthAvailabilityRange(args.month, timeZone);
			const busyWindows = await getBusyWindowsInRange({
				calendar,
				calendarId,
				timeMax,
				timeMin,
				timeZone,
			});

			return {
				busyWindows: groupBusyWindowsByDay(busyWindows, timeZone),
				month: args.month,
				timeZone,
			};
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			const code = getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED");
			console.error("Google Calendar month availability lookup failed", {
				month: args.month,
				...getGoogleCalendarErrorDetails(error),
			});
			throw createBookingCalendarError(code);
		}
	},
});

export const getAvailableBookingTimes = action({
	args: {
		date: v.string(),
		duration: v.string(),
	},
	handler: async (_ctx, args): Promise<AvailableBookingTimesResult> => {
		try {
			const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
			const busyWindows = await getBusyWindows({
				calendar,
				calendarId,
				date: args.date,
				timeZone,
			});
			const times = getAvailableTimeOptions({
				busyWindows,
				date: args.date,
				duration: args.duration,
				timeZone,
			});

			return {
				timeZone,
				times,
			};
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			const code = getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED");
			console.error("Google Calendar availability lookup failed", {
				date: args.date,
				...getGoogleCalendarErrorDetails(error),
			});
			throw createBookingCalendarError(code);
		}
	},
});

export const createBookingWithCalendarEvent = action({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<CreateBookingWithCalendarEventResult> => {
		try {
			const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
			const hostEmails = (env.GOOGLE_CALENDAR_HOST_EMAILS ?? "")
				.split(",")
				.map((email) => email.trim())
				.filter(Boolean);
			const busyWindows = await getBusyWindows({
				calendar,
				calendarId,
				date: args.date,
				timeZone,
			});

			if (
				!isTimeSlotAvailable({
					busyWindows,
					date: args.date,
					duration: args.duration,
					time: args.time,
					timeZone,
				})
			) {
				throw createBookingCalendarError("BOOKING_TIME_UNAVAILABLE");
			}

			const { startDateTime, endDateTime } = buildEventWindow(
				args.date,
				args.time,
				args.duration,
				timeZone,
			);

			let googleEventId: string | undefined;
			let htmlLink: string | null = null;
			try {
				const event = await calendar.events.insert({
					calendarId,
					sendUpdates: "all",
					requestBody: {
						summary: `${args.service} - ${args.name}`,
						description: [
							`Name: ${args.name}`,
							`Phone: ${args.phone}`,
							`Account Name: ${args.accountName}`,
							args.abn ? `ABN: ${args.abn}` : undefined,
							`Email: ${args.email}`,
							`Service: ${args.service}`,
							args.addons.length > 0 ? `Add-ons: ${args.addons.join(", ")}` : undefined,
							args.notes ? `Notes: ${args.notes}` : undefined,
						]
							.filter(Boolean)
							.join("\n"),
						start: {
							dateTime: startDateTime,
						},
						end: {
							dateTime: endDateTime,
						},
						transparency: "opaque",
						attendees: [{ email: args.email }, ...hostEmails.map((email) => ({ email }))],
					},
				});

				googleEventId = event.data.id ?? undefined;
				htmlLink = event.data.htmlLink ?? null;
			} catch (error) {
				console.error("Google Calendar event insert failed", {
					error,
					bookingEmail: args.email,
					calendarId,
				});
				throw createBookingCalendarError(
					getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED"),
				);
			}

			try {
				const bookingId: Id<"bookings"> = await ctx.runMutation(internal.bookings.storeBooking, {
					name: args.name,
					phone: args.phone,
					accountName: args.accountName,
					abn: args.abn,
					email: args.email,
					date: args.date,
					time: args.time,
					duration: args.duration,
					service: args.service,
					addons: args.addons,
					notes: args.notes,
					googleEventId,
					googleCalendarId: calendarId,
				});

				return {
					bookingId,
					googleEventId: googleEventId ?? null,
					htmlLink,
				};
			} catch (error) {
				console.error("Booking storage failed after Google Calendar event creation", {
					error,
					bookingEmail: args.email,
					calendarId,
					googleEventId: googleEventId ?? null,
				});
				throw createBookingCalendarError("BOOKING_STORE_FAILED");
			}
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			console.error("Unexpected booking calendar error", {
				error,
				bookingEmail: args.email,
			});
			throw createBookingCalendarError("GOOGLE_CALENDAR_CREATE_FAILED");
		}
	},
});
