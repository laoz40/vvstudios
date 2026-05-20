"use node";

import { ConvexError, v } from "convex/values";
import { google } from "googleapis";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { bookingSchema } from "../src/sites/studio/features/booking-form/lib/form-shared";
import {
	formatDateValue,
	getLastBookableDate,
	startOfToday,
} from "../src/sites/studio/lib/bookingdatetime";
import { env } from "./env";
import {
	assertBookingMeetsAvailabilitySettings,
	buildEventWindow,
	formatBookingDateShort,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
} from "./lib/bookingCalendarTime";
import {
	buildBookingCalendarEventRequestBody,
	sendBookingHostDetailsEmail,
	sendBookingInvoiceEmail,
	sendBookingReminderEmailForBooking as sendReminderEmailForBookingDetails,
} from "./lib/email";
import {
	getGoogleCalendarErrorCode,
	getGoogleCalendarErrorDetails,
} from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { rateLimiter } from "./lib/rateLimits";
import { createBookingInvoiceArtifacts } from "../src/sites/studio/features/booking-invoice/lib/create-booking-invoice-artifacts";

type BookingCalendarErrorCode =
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED"
	| "GOOGLE_CALENDAR_RATE_LIMITED";

type BookingCalendarErrorData = {
	code: BookingCalendarErrorCode;
};

type BookingInvoiceEmailErrorCode =
	| "NOT_AUTHENTICATED"
	| "BOOKING_NOT_FOUND"
	| "INVALID_BOOKING_DATA"
	| "INVOICE_SEND_FAILED";

type BookingInvoiceEmailErrorData = {
	code: BookingInvoiceEmailErrorCode;
};

interface AvailableBookingTimesResult {
	timeZone: string;
	times: string[];
}

interface BusyDayWindowResult {
	busyPeriods: Array<{ end: string; start: string }>;
	date: string;
	label: string;
}

interface BookableRangeBusyWindowsResult {
	busyWindowsByMonth: Record<string, BusyDayWindowResult[]>;
	timeZone: string;
}

function createBookingCalendarError(code: BookingCalendarErrorCode) {
	return new ConvexError<BookingCalendarErrorData>({ code });
}

function createBookingInvoiceEmailError(code: BookingInvoiceEmailErrorCode) {
	return new ConvexError<BookingInvoiceEmailErrorData>({ code });
}

function parseGoogleCalendarAvailabilityIds(calendarId: string) {
	return (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? calendarId)
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

function getGoogleCalendarClient() {
	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const refreshToken = env.GOOGLE_REFRESH_TOKEN;
	const calendarId = env.GOOGLE_CALENDAR_ID;
	const calendarIds = parseGoogleCalendarAvailabilityIds(calendarId);
	const timeZone = env.GOOGLE_CALENDAR_TIMEZONE;

	const oauth2Client = new google.auth.OAuth2({
		clientId,
		clientSecret,
	});
	oauth2Client.setCredentials({ refresh_token: refreshToken });

	return {
		calendarId,
		calendarIds,
		timeZone,
		calendar: google.calendar({ version: "v3", auth: oauth2Client }),
	};
}

async function sendBookingInvoiceForBookingRecord(booking: Doc<"bookings">) {
	const parsedBooking = bookingSchema.safeParse({
		name: booking.name,
		phone: booking.phone,
		accountName: booking.accountName,
		abn: booking.abn,
		email: booking.email,
		date: booking.date,
		time: booking.time,
		duration: booking.duration,
		service: booking.service,
		addons: booking.addons,
		notes: booking.notes ?? "",
	});

	if (!parsedBooking.success) {
		throw createBookingInvoiceEmailError("INVALID_BOOKING_DATA");
	}

	const artifacts = await createBookingInvoiceArtifacts({
		bookingId: booking._id,
		name: parsedBooking.data.name,
		phone: parsedBooking.data.phone,
		accountName: parsedBooking.data.accountName,
		abn: parsedBooking.data.abn,
		email: parsedBooking.data.email,
		date: parsedBooking.data.date,
		time: parsedBooking.data.time,
		duration: parsedBooking.data.duration,
		service: parsedBooking.data.service,
		addons: parsedBooking.data.addons,
		createdAt: Date.now(),
	});

	await sendBookingInvoiceEmail({
		to: booking.email,
		subject: `Your Studio Booking Invoice - ${formatBookingDateShort(booking.date)}`,
		html: artifacts.emailHtml,
		attachment: artifacts.pdf,
	});

	await sendBookingHostDetailsEmail({
		invoiceNumber: artifacts.data.invoice.number,
		name: parsedBooking.data.name,
		email: parsedBooking.data.email,
		phone: parsedBooking.data.phone,
		accountName: parsedBooking.data.accountName,
		abn: parsedBooking.data.abn,
		date: parsedBooking.data.date,
		time: parsedBooking.data.time,
		service: parsedBooking.data.service,
		duration: parsedBooking.data.duration,
		addons: parsedBooking.data.addons,
		notes: parsedBooking.data.notes,
	});
}

async function sendBookingReminderEmailForBookingRecord(booking: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();
	const { startDateTime } = buildEventWindow(
		booking.date,
		booking.time,
		booking.duration,
		timeZone,
	);

	await sendReminderEmailForBookingDetails({
		name: booking.name,
		email: booking.email,
		date: booking.date,
		startDateTime,
		timeZone,
		service: booking.service,
		duration: booking.duration,
		addons: booking.addons,
	});
}

export const getBookableRangeBusyWindows = action({
	args: {
		rateLimitKey: v.string(),
	},
	handler: async (ctx, args): Promise<BookableRangeBusyWindowsResult> => {
		try {
			const globalRateLimitStatus = await rateLimiter.limit(
				ctx,
				"googleCalendarAvailabilityGlobal",
			);
			const rateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailability", {
				key: args.rateLimitKey,
			});

			if (!globalRateLimitStatus.ok || !rateLimitStatus.ok) {
				throw createBookingCalendarError("GOOGLE_CALENDAR_RATE_LIMITED");
			}

			const settings = await ctx.runQuery(api.bookingSettings.get, {});
			const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
			const today = startOfToday();
			const startDate = formatDateValue(today);
			const endDate = formatDateValue(getLastBookableDate(today, settings.maxDaysAhead));
			const { timeMin, timeMax } = getDateAvailabilityRange(startDate, endDate, timeZone);
			const busyWindows = await getBusyWindowsInRange({
				calendar,
				calendarIds,
				timeMax,
				timeMin,
				timeZone,
			});

			const busyWindowsByMonth: Record<string, BusyDayWindowResult[]> = {};

			for (const busyDay of groupBusyWindowsByDay(busyWindows, timeZone)) {
				const month = busyDay.date.slice(0, 7);
				busyWindowsByMonth[month] = [...(busyWindowsByMonth[month] ?? []), busyDay];
			}

			return { busyWindowsByMonth, timeZone };
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			const code = getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED");
			console.error("Google Calendar range availability lookup failed", {
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
	handler: async (ctx, args): Promise<AvailableBookingTimesResult> => {
		try {
			const settings = await ctx.runQuery(api.bookingSettings.get, {});
			const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
			const busyWindows = await getBusyWindows({
				calendar,
				calendarIds,
				date: args.date,
				timeZone,
			});
			const times = getAvailableTimeOptions({
				busyWindows,
				date: args.date,
				duration: args.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
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

export const sendBookingInvoiceForBooking = action({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw createBookingInvoiceEmailError("NOT_AUTHENTICATED");
		}

		const booking = await ctx.runQuery(internal.bookings.getBookingByIdInternal, {
			bookingId: args.bookingId,
		});

		if (!booking) {
			throw createBookingInvoiceEmailError("BOOKING_NOT_FOUND");
		}

		try {
			await sendBookingInvoiceForBookingRecord(booking);
			return { ok: true as const };
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			console.error("Manual booking invoice send failed", {
				bookingId: booking._id,
				bookingEmail: booking.email,
				error,
			});
			throw createBookingInvoiceEmailError("INVOICE_SEND_FAILED");
		}
	},
});

export const sendBookingReminderEmailForBooking = internalAction({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const claim = await ctx.runMutation(internal.bookings.claimBookingReminderEmail, {
			bookingId: args.bookingId,
			now,
		});

		if (!claim.ok) {
			return null;
		}

		try {
			await sendBookingReminderEmailForBookingRecord(claim.booking);

			await ctx.runMutation(internal.bookings.markBookingReminderEmailSent, {
				bookingId: args.bookingId,
				now: Date.now(),
			});
		} catch (error) {
			console.error("Booking reminder email send failed", {
				bookingId: args.bookingId,
				error,
			});

			await ctx.runMutation(internal.bookings.markBookingReminderEmailFailed, {
				bookingId: args.bookingId,
				failureCode: "RESEND_SEND_FAILED",
			});
		}

		return null;
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
			const settings = await ctx.runQuery(api.bookingSettings.get, {});
			const { calendar, calendarId, calendarIds, timeZone } = getGoogleCalendarClient();

			try {
				assertBookingMeetsAvailabilitySettings({
					date: booking.date,
					duration: booking.duration,
					settings,
					time: booking.time,
					timeZone,
				});
			} catch {
				await ctx.runMutation(internal.bookings.markBookingCompletionFailed, {
					bookingId: booking._id,
					failureCode: "BOOKING_TIME_UNAVAILABLE",
				});
				return null;
			}

			const busyWindows = await getBusyWindows({
				calendar,
				calendarIds,
				date: booking.date,
				timeZone,
			});

			if (
				!isTimeSlotAvailable({
					busyWindows,
					date: booking.date,
					duration: booking.duration,
					eventBufferMinutes: settings.eventBufferMinutes,
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
					addons: booking.addons,
					name: booking.name,
					duration: booking.duration,
					email: booking.email,
					service: booking.service,
					startDateTime,
					endDateTime,
					timeZone,
				}),
			});

			const googleEventId = event.data.id ?? undefined;

			await ctx.runMutation(internal.bookings.markBookingCompleted, {
				bookingId: booking._id,
				googleEventId,
				googleCalendarId: calendarId,
			});

			try {
				await sendBookingInvoiceForBookingRecord(booking);
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
