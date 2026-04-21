"use node";

import { ConvexError, v } from "convex/values";
import { google } from "googleapis";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type {
	BookingAddon,
	BookingDuration,
	BookingService,
} from "../src/features/booking-invoice/lib/types";
import { env } from "./env";
import {
	buildEventWindow,
	formatBookingDateShort,
	getAvailableTimeOptions,
	getMonthAvailabilityRange,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
} from "./lib/bookingTimeUtils";
import { buildBookingCalendarEventRequestBody, sendBookingInvoiceEmail } from "./lib/email";
import {
	getGoogleCalendarErrorCode,
	getGoogleCalendarErrorDetails,
} from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { createBookingInvoiceArtifacts } from "../src/features/booking-invoice/lib/create-booking-invoice-artifacts";

type BookingCalendarErrorCode =
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
	const calendarId = env.GOOGLE_CALENDAR_ID;
	const timeZone = env.GOOGLE_CALENDAR_TIMEZONE;

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

export const completeClaimedBooking = internalAction({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.runQuery(internal.bookings.getBookingByIdInternal, {
			bookingId: args.bookingId,
		});

		if (!booking) {
			throw new Error("Booking not found");
		}

		if (!booking.bookingConfirmationClaimedAt) {
			throw new Error("Booking confirmation was not claimed");
		}

		if (booking.status === "confirmed") {
			return null;
		}

		try {
			const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
			const hostEmails = env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
				.map((email) => email.trim())
				.filter(Boolean);

			const busyWindows = await getBusyWindows({
				calendar,
				calendarId,
				date: booking.date,
				timeZone,
			});

			if (
				!isTimeSlotAvailable({
					busyWindows,
					date: booking.date,
					duration: booking.duration,
					time: booking.time,
					timeZone,
				})
			) {
				await ctx.runMutation(internal.bookings.markBookingCompletionFailed, {
					bookingId: booking._id,
					failureCode: "BOOKING_TIME_UNAVAILABLE",
				});
				return null;
			}

			const { startDateTime, endDateTime } = buildEventWindow(
				booking.date,
				booking.time,
				booking.duration,
				timeZone,
			);

			const event = await calendar.events.insert({
				calendarId,
				sendUpdates: "all",
				requestBody: buildBookingCalendarEventRequestBody({
					name: booking.name,
					duration: booking.duration,
					email: booking.email,
					service: booking.service,
					startDateTime,
					endDateTime,
					timeZone,
					hostEmails,
				}),
			});

			const googleEventId = event.data.id ?? undefined;

			await ctx.runMutation(internal.bookings.markBookingCompleted, {
				bookingId: booking._id,
				googleEventId,
				googleCalendarId: calendarId,
			});

			try {
				const artifacts = await createBookingInvoiceArtifacts({
					bookingId: booking._id,
					name: booking.name,
					phone: booking.phone,
					accountName: booking.accountName,
					abn: booking.abn,
					email: booking.email,
					date: booking.date,
					time: booking.time,
					duration: booking.duration as BookingDuration,
					service: booking.service as BookingService,
					addons: booking.addons as BookingAddon[],
					createdAt: Date.now(),
				});

				await sendBookingInvoiceEmail({
					to: booking.email,
					subject: `Your Studio Booking Invoice - ${formatBookingDateShort(booking.date)}`,
					html: artifacts.emailHtml,
					attachment: artifacts.pdf,
				});
			} catch (invoiceError) {
				console.error("Booking invoice artifact generation or send failed", {
					bookingId: booking._id,
					bookingEmail: booking.email,
					error: invoiceError,
				});
			}

			return null;
		} catch (error) {
			console.error("Claimed booking completion failed", {
				bookingId: booking._id,
				error,
			});

			await ctx.runMutation(internal.bookings.markBookingCompletionFailed, {
				bookingId: booking._id,
				failureCode: "GOOGLE_CALENDAR_CREATE_FAILED",
			});

			return null;
		}
	},
});
