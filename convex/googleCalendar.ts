"use node";

import { ConvexError, v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { api, internal } from "./_generated/api";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
	formatDateValue,
	getLastBookableDate,
	startOfToday
} from "../src/sites/studio/lib/bookingdatetime";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { isAdminIdentity, requireAdmin } from "./lib/auth";
import {
	buildEventWindow,
	type BookingAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyWindowsByDay
} from "./lib/bookingCalendarTime";
import {
	sendBookingInvoiceEmailsForBooking,
	sendBookingReminderEmailForBooking as sendReminderEmailForBookingDetails
} from "./lib/email";
import {
	failBookingCompletion,
	type AdminBookingUpdateArgs,
	type AdminBookingUpdateError,
	type AdminBookingUpdateResult,
	verifyBookingCanBeScheduled,
	updateBookingFromAdminWithGoogleCalendar
} from "./lib/bookingAdminEdit";
import { deleteBookingCalendarEvent } from "./lib/googleCalendarEventDeletion";
import { buildBookingCalendarEventPayload } from "./lib/googleCalendarEvents";
import { throwGoogleCalendarConvexError } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { rateLimiter } from "./lib/rateLimits";

type BookingCalendarErrorCode =
	| "BOOKING_TIME_UNAVAILABLE"
	| "BOOKING_NOT_FOUND"
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED"
	| "GOOGLE_CALENDAR_DELETE_FAILED"
	| "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
	| "GOOGLE_CALENDAR_RATE_LIMITED"
	| "GOOGLE_CALENDAR_UPDATE_FAILED";

type BookingCalendarErrorData = { code: BookingCalendarErrorCode };

type BookingInvoiceEmailErrorCode =
	| "NOT_AUTHENTICATED"
	| "BOOKING_NOT_FOUND"
	| "INVALID_BOOKING_DATA"
	| "INVOICE_SEND_FAILED";

type BookingInvoiceEmailErrorData = { code: BookingInvoiceEmailErrorCode };

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };

export type DeleteBookingFromAdminResult = Awaited<
	ReturnType<typeof deleteBookingFromAdminHandler>
>;

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

async function sendBookingReminderEmailForBookingRecord(booking: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();
	const { startDateTime } = buildEventWindow(
		booking.date,
		booking.time,
		booking.duration,
		timeZone
	);

	await sendReminderEmailForBookingDetails({
		name: booking.name,
		email: booking.email,
		date: booking.date,
		startDateTime,
		timeZone,
		service: booking.service,
		duration: booking.duration,
		addons: booking.addons
	});
}

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: async (ctx, args): Promise<BookableRangeBusyWindowsResult> => {
		try {
			const globalRateLimitStatus = await rateLimiter.limit(
				ctx,
				"googleCalendarAvailabilityGlobal"
			);
			const rateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailability", {
				key: args.rateLimitKey
			});

			if (!globalRateLimitStatus.ok || !rateLimitStatus.ok) {
				throw new ConvexError<BookingCalendarErrorData>({ code: "GOOGLE_CALENDAR_RATE_LIMITED" });
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
				timeZone
			});

			const busyWindowsByMonth: Record<string, BusyDayWindowResult[]> = {};

			for (const busyDay of groupBusyWindowsByDay(busyWindows, timeZone)) {
				const month = busyDay.date.slice(0, 7);
				busyWindowsByMonth[month] = [...(busyWindowsByMonth[month] ?? []), busyDay];
			}

			return { busyWindowsByMonth, timeZone };
		} catch (error) {
			throwGoogleCalendarConvexError(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED");
		}
	}
});

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: async (ctx, args): Promise<AvailableBookingTimesResult> => {
		try {
			const settings = await ctx.runQuery(api.bookingSettings.get, {});
			const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
			const busyWindows = await getBusyWindows({
				calendar,
				calendarIds,
				date: args.date,
				timeZone
			});
			const times = getAvailableTimeOptions({
				busyWindows,
				date: args.date,
				duration: args.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
				timeZone
			});

			return { timeZone, times };
		} catch (error) {
			throwGoogleCalendarConvexError(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED");
		}
	}
});

export const updateBookingFromAdmin = action({
	args: {
		bookingId: v.id("bookings"),
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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: updateBookingFromAdminHandler
});

type UpdateBookingFromAdminError =
	| AdminBookingUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

async function updateBookingFromAdminHandler(
	ctx: ActionCtx,
	args: AdminBookingUpdateArgs
): Promise<Result<AdminBookingUpdateResult, UpdateBookingFromAdminError>> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	const booking: Doc<"bookings"> | null = await ctx.runQuery(
		internal.bookings.getBookingByIdInternal,
		{ bookingId: args.bookingId }
	);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});
	const client = getGoogleCalendarClient();

	return updateBookingFromAdminWithGoogleCalendar({ args, booking, client, ctx, settings });
}

export type UpdateBookingFromAdminResult = Awaited<
	ReturnType<typeof updateBookingFromAdminHandler>
>;

export const sendBookingInvoiceForBooking = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const booking = await ctx.runQuery(internal.bookings.getBookingByIdInternal, {
			bookingId: args.bookingId
		});

		if (!booking) {
			throw new ConvexError<BookingInvoiceEmailErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		try {
			await sendBookingInvoiceEmailsForBooking(booking);
			await ctx.runMutation(internal.bookings.markBookingInvoiceEmailSent, {
				bookingId: booking._id
			});
			return { ok: true as const };
		} catch (error) {
			if (error instanceof ConvexError) throw error;
			throw new ConvexError<BookingInvoiceEmailErrorData>({ code: "INVOICE_SEND_FAILED" });
		}
	}
});

export const deleteBookingFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: deleteBookingFromAdminHandler
});

async function deleteBookingFromAdminHandler(ctx: ActionCtx, args: DeleteBookingFromAdminArgs) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	const booking: Doc<"bookings"> | null = await ctx.runQuery(
		internal.bookings.getBookingByIdInternal,
		{ bookingId: args.bookingId }
	);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	const [error] = await deleteBookingCalendarEvent({ booking });

	if (error !== null) {
		return err(error);
	}

	try {
		await ctx.runMutation(internal.bookings.deleteBookingInternal, { bookingId: args.bookingId });
	} catch {
		return err({ reason: "BOOKING_DELETE_FAILED" });
	}

	return ok({ deleted: true });
}

export const sendBookingReminderEmailForBooking = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const now = Date.now();
		const claim = await ctx.runMutation(internal.bookings.claimBookingReminderEmail, {
			bookingId: args.bookingId,
			now
		});

		if (!claim.ok) return null;

		try {
			await sendBookingReminderEmailForBookingRecord(claim.booking);

			await ctx.runMutation(internal.bookings.markBookingReminderEmailSent, {
				bookingId: args.bookingId,
				now: Date.now()
			});
		} catch {
			await ctx.runMutation(internal.bookings.markBookingReminderEmailFailed, {
				bookingId: args.bookingId,
				failureCode: "RESEND_SEND_FAILED"
			});
		}

		return null;
	}
});

export const completeClaimedBooking = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const booking = await ctx.runQuery(internal.bookings.getBookingByIdInternal, {
			bookingId: args.bookingId
		});

		if (!booking) throw new Error("Booking not found");

		if (!booking.bookingConfirmationClaimedAt) {
			throw new Error("Booking confirmation was not claimed");
		}

		if (booking.status === "confirmed" || booking.status === "email_failed") {
			return null;
		}

		try {
			const settings = await ctx.runQuery(api.bookingSettings.get, {});
			const calendarClient = getGoogleCalendarClient();

			const canBeScheduled = await verifyBookingCanBeScheduled({
				booking,
				calendar: calendarClient.calendar,
				calendarIds: calendarClient.calendarIds,
				settings,
				timeZone: calendarClient.timeZone
			});

			if (!canBeScheduled) {
				await failBookingCompletion(ctx, booking._id, "BOOKING_TIME_UNAVAILABLE");
				return null;
			}

			const createdEvent = await calendarClient.calendar.events.insert({
				calendarId: calendarClient.calendarId,
				sendUpdates: "all",
				requestBody: buildBookingCalendarEventPayload({
					date: booking.date,
					time: booking.time,
					timeZone: calendarClient.timeZone,
					details: {
						addons: booking.addons,
						name: booking.name,
						duration: booking.duration,
						email: booking.email,
						service: booking.service
					}
				})
			});
			const googleEventId = createdEvent.data.id ?? undefined;

			// save confirmed status and Google event details.
			await ctx.runMutation(internal.bookings.markBookingCompleted, {
				bookingId: booking._id,
				googleEventId,
				googleCalendarId: calendarClient.calendarId
			});

			try {
				await sendBookingInvoiceEmailsForBooking(booking);
			} catch {
				await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
					bookingId: booking._id
				});
			}

			return null;
		} catch {
			await failBookingCompletion(ctx, booking._id, "GOOGLE_CALENDAR_CREATE_FAILED");

			return null;
		}
	}
});
