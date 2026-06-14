"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { api, internal } from "./_generated/api";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
	formatDateValue,
	getLastBookableDate,
	startOfToday
} from "../src/sites/studio/lib/bookingdatetime";
import { createRescheduleUrlForBooking } from "./bookingReschedule";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { getAdminIdentity } from "./lib/auth";
import { getBookingFromQuery } from "./lib/bookingLookup";
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
import {
	buildBookingCalendarEventPayload,
	deleteBookingCalendarEvent
} from "./lib/googleCalendarEvents";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { rateLimiter } from "./lib/rateLimits";
import type { RescheduleLinkLookupError } from "./bookingReschedule";

type SendBookingInvoiceForBookingArgs = { bookingId: Id<"bookings"> };

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };

export type DeleteBookingFromAdminResult = Awaited<
	ReturnType<typeof deleteBookingFromAdminHandler>
>;

interface BusyDayWindowResult {
	busyPeriods: Array<{ end: string; start: string }>;
	date: string;
	label: string;
}

async function sendBookingReminderEmailForBookingRecord(booking: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();
	const [windowError, eventWindow] = buildEventWindow(
		booking.date,
		booking.time,
		booking.duration,
		timeZone
	);

	if (windowError !== null) {
		return err(windowError);
	}

	const { startDateTime } = eventWindow;

	const [emailError] = await sendReminderEmailForBookingDetails({
		name: booking.name,
		email: booking.email,
		date: booking.date,
		startDateTime,
		timeZone,
		service: booking.service,
		duration: booking.duration,
		addons: booking.addons
	});

	if (emailError !== null) {
		console.error("Booking reminder email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			reason: emailError.reason
		});
		return err({ reason: "RESEND_SEND_FAILED" });
	}

	return ok({ sent: true });
}

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: (ctx, args) => getBookableRangeBusyWindowsHandler(ctx, args)
});

async function getBookableRangeBusyWindowsHandler(ctx: ActionCtx, args: { rateLimitKey: string }) {
	const globalRateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailabilityGlobal");
	const rateLimitStatus = await rateLimiter.limit(ctx, "googleCalendarAvailability", {
		key: args.rateLimitKey
	});

	if (!globalRateLimitStatus.ok || !rateLimitStatus.ok) {
		return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });
	}

	try {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
		const today = startOfToday();
		const startDate = formatDateValue(today);
		const endDate = formatDateValue(getLastBookableDate(today, settings.maxDaysAhead));
		const [rangeError, availabilityRange] = getDateAvailabilityRange(startDate, endDate, timeZone);

		if (rangeError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
		}

		const { timeMin, timeMax } = availabilityRange;
		const busyWindows = await getBusyWindowsInRange({
			calendar,
			calendarIds,
			timeMax,
			timeMin,
			timeZone
		});

		const [busyDaysError, busyDays] = groupBusyWindowsByDay(busyWindows, timeZone);

		if (busyDaysError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
		}

		const busyWindowsByMonth: Record<string, BusyDayWindowResult[]> = {};

		for (const busyDay of busyDays) {
			const month = busyDay.date.slice(0, 7);
			busyWindowsByMonth[month] = [...(busyWindowsByMonth[month] ?? []), busyDay];
		}

		return ok({ busyWindowsByMonth, timeZone });
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
}

export type GetBookableRangeBusyWindowsResult = Awaited<
	ReturnType<typeof getBookableRangeBusyWindowsHandler>
>;

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: (ctx, args) => getAvailableBookingTimesHandler(ctx, args)
});

async function getAvailableBookingTimesHandler(
	ctx: ActionCtx,
	args: { date: string; duration: string }
) {
	try {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
		const busyWindows = await getBusyWindows({ calendar, calendarIds, date: args.date, timeZone });
		const times = getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: args.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			timeZone
		});

		return ok({ timeZone, times });
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
}

type GetAvailableRescheduleTimesSuccess = { timeZone: string; times: string[] };
export type GetAvailableBookingTimesResult = Awaited<
	ReturnType<typeof getAvailableBookingTimesHandler>
>;

type GetAvailableRescheduleTimesArgs = { date: string; token: string };

export type GetAvailableRescheduleTimesError =
	| RescheduleLinkLookupError
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

export const getAvailableRescheduleTimes = action({
	args: { token: v.string(), date: v.string() },
	handler: (ctx, args) => getAvailableRescheduleTimesHandler(ctx, args)
});

async function getAvailableRescheduleTimesHandler(
	ctx: ActionCtx,
	args: GetAvailableRescheduleTimesArgs
): Promise<Result<GetAvailableRescheduleTimesSuccess, GetAvailableRescheduleTimesError>> {
	const [lookupError, result] = await ctx.runQuery(
		internal.bookingReschedule.getValidRescheduleLinkAndBookingInternal,
		{ now: Date.now(), token: args.token }
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	try {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
		const busyWindows = await getBusyWindows({
			calendar,
			calendarIds,
			date: args.date,
			ignoredEvent: {
				calendarId: result.booking.googleCalendarId,
				eventId: result.booking.googleEventId
			},
			timeZone
		});
		const times = getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: result.booking.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			timeZone
		});

		return ok({ timeZone, times });
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
}

export type GetAvailableRescheduleTimesResult = Awaited<
	ReturnType<typeof getAvailableRescheduleTimesHandler>
>;

type UpdateBookingFromAdminError =
	| AdminBookingUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

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

async function updateBookingFromAdminHandler(
	ctx: ActionCtx,
	args: AdminBookingUpdateArgs
): Promise<Result<AdminBookingUpdateResult, UpdateBookingFromAdminError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
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
	handler: (ctx, args) => sendBookingInvoiceForBookingHandler(ctx, args)
});

async function sendBookingInvoiceForBookingHandler(
	ctx: ActionCtx,
	args: SendBookingInvoiceForBookingArgs
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	const [linkError, rescheduleUrl] = await createRescheduleUrlForBooking(ctx, booking);

	if (linkError !== null) {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(booking, rescheduleUrl);

	if (emailError !== null) {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	try {
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailSent, {
			bookingId: booking._id
		});
	} catch {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	return ok({ sent: true });
}

export type SendBookingInvoiceForBookingResult = Awaited<
	ReturnType<typeof sendBookingInvoiceForBookingHandler>
>;

export const deleteBookingFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: deleteBookingFromAdminHandler
});

async function deleteBookingFromAdminHandler(ctx: ActionCtx, args: DeleteBookingFromAdminArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	const client = getGoogleCalendarClient();
	const [error] = await deleteBookingCalendarEvent({ booking, client });

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
		const [claimError, claim] = await ctx.runMutation(internal.bookings.claimBookingReminderEmail, {
			bookingId: args.bookingId,
			now
		});

		if (claimError !== null) return null;

		const [reminderEmailError] = await sendBookingReminderEmailForBookingRecord(claim.booking);

		if (reminderEmailError !== null) {
			await ctx.runMutation(internal.bookings.markBookingReminderEmailFailed, {
				bookingId: args.bookingId,
				failureCode: reminderEmailError.reason
			});
			return null;
		}

		await ctx.runMutation(internal.bookings.markBookingReminderEmailSent, {
			bookingId: args.bookingId,
			now: Date.now()
		});

		return null;
	}
});

export const completeClaimedBooking = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => completeClaimedBookingHandler(ctx, args)
});

async function completeClaimedBookingHandler(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	const [bookingError, booking] = await getBookingFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	if (!booking.bookingConfirmationClaimedAt) {
		return err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" });
	}

	if (booking.status === "confirmed" || booking.status === "email_failed") {
		return ok({ completed: true, outcome: "already_completed" });
	}

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
		return ok({ completed: false, outcome: "booking_time_unavailable" });
	}

	const [payloadError, requestBody] = buildBookingCalendarEventPayload({
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
	});

	if (payloadError !== null) {
		await failBookingCompletion(ctx, booking._id, "BOOKING_INVALID_INPUT");
		return ok({ completed: false, outcome: "booking_invalid_input" });
	}

	let googleEventId: string | undefined;

	try {
		const createdEvent = await calendarClient.calendar.events.insert({
			calendarId: calendarClient.calendarId,
			sendUpdates: "all",
			requestBody
		});
		googleEventId = createdEvent.data.id ?? undefined;
	} catch {
		await failBookingCompletion(ctx, booking._id, "GOOGLE_CALENDAR_CREATE_FAILED");

		return ok({ completed: false, outcome: "google_calendar_create_failed" });
	}

	await ctx.runMutation(internal.bookings.markBookingCompleted, {
		bookingId: booking._id,
		googleEventId,
		googleCalendarId: calendarClient.calendarId
	});

	const [linkError, rescheduleUrl] = await createRescheduleUrlForBooking(ctx, booking);

	if (linkError !== null) {
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
		return ok({ completed: true, outcome: "completed" });
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(booking, rescheduleUrl);

	if (emailError !== null) {
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
	}

	return ok({ completed: true, outcome: "completed" });
}

export type CompleteClaimedBookingResult = Awaited<
	ReturnType<typeof completeClaimedBookingHandler>
>;
