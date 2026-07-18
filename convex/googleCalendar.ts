"use node";

import { createHash } from "node:crypto";
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
import { createRescheduleUrlForBooking, getRescheduleUrlForToken } from "./bookingReschedule";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { getAdminIdentity } from "./lib/auth";
import { getBookingFromQuery } from "./lib/bookingLookup";
import {
	buildEventWindow,
	type BookingAvailabilitySettings,
	type BusyDayWindow,
	checkBookingMeetsAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay
} from "./lib/bookingCalendarTime";
import {
	sendBookingInvoiceEmailsForBooking,
	sendBookingReminderEmailForBooking as sendReminderEmailForBookingDetails
} from "./lib/email";
import {
	failBookingCompletion,
	getBookingSessionStartAt,
	type AdminBookingUpdateArgs,
	type AdminBookingUpdateError,
	type AdminBookingUpdateResult,
	validateBookingTimingEdit,
	verifyBookingCanBeScheduled,
	updateBookingFromAdminWithGoogleCalendar,
	updateBookingTimingWithGoogleCalendar
} from "./lib/bookingAdminEdit";
import {
	buildBookingCalendarEventPayload,
	deleteBookingCalendarEvent
} from "./lib/googleCalendarEvents";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import {
	checkBookingSubmitRateLimit,
	checkGoogleCalendarAvailabilityRateLimit
} from "./lib/rateLimits";
import type { RescheduleLinkLookupError } from "./bookingReschedule";
import type { MarkBookingCalendarEventDeletedResult } from "./bookings";
import type { BookingTimeLock } from "./lib/bookingSlotLocks";

function getBookingSubmitRateLimitKey(email: string) {
	return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

type SendBookingInvoiceForBookingArgs = { bookingId: Id<"bookings"> };

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };
export type DeleteBookingFromAdminResult = Result<
	{ deleted: boolean },
	{
		reason:
			| "NOT_AUTHENTICATED"
			| "NOT_AUTHORIZED"
			| "BOOKING_NOT_FOUND"
			| "GOOGLE_CALENDAR_AUTH_FAILED"
			| "GOOGLE_CALENDAR_DELETE_FAILED"
			| "GOOGLE_CALENDAR_RATE_LIMITED"
			| "BOOKING_STATUS_UPDATE_FAILED";
	}
>;
type IgnoredBusyEvent = { calendarId?: string; eventId?: string };

async function getBookableRangeBusyWindowsFromGoogleCalendar({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: BookingAvailabilitySettings;
}): Promise<
	Result<
		{ busyWindowsByMonth: Record<string, BusyDayWindow[]>; timeZone: string },
		{ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	>
> {
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
		ignoredEvent,
		timeMax,
		timeMin,
		timeZone
	});
	const [busyDaysError, busyDays] = groupBusyWindowsByDay(busyWindows, timeZone);

	if (busyDaysError !== null) {
		return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
	}

	return ok({ busyWindowsByMonth: groupBusyDaysByMonth(busyDays), timeZone });
}

async function sendBookingReminderEmailForBookingRecord(ctx: ActionCtx, booking: Doc<"bookings">) {
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

	let rescheduleUrl: string | undefined;

	if (booking.multiBookingPackageId === undefined) {
		const [linkError, bookingRescheduleUrl] = await createRescheduleUrlForBooking(ctx, booking);

		if (linkError !== null) {
			return err({ reason: "RESCHEDULE_LINK_CREATE_FAILED" });
		}

		rescheduleUrl = bookingRescheduleUrl;
	}

	const [emailError] = await sendReminderEmailForBookingDetails({
		name: booking.name,
		email: booking.email,
		date: booking.date,
		startDateTime,
		time: booking.time,
		timeZone,
		service: booking.service,
		duration: booking.duration,
		addons: booking.addons,
		rescheduleUrl,
		isPackageBooking: booking.multiBookingPackageId !== undefined
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
	const [rateLimitError] = await checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	try {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const [availabilityError, availability] = await getBookableRangeBusyWindowsFromGoogleCalendar({
			settings
		});

		if (availabilityError !== null) {
			return err(availabilityError);
		}

		return ok(availability);
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

type RescheduleLinkAndBookingLookupResult = Result<
	{ booking: Doc<"bookings">; link: Doc<"bookingRescheduleLinks"> },
	RescheduleLinkLookupError
>;

export const getRescheduleBookableRangeBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: (ctx, args) => getRescheduleBookableRangeBusyWindowsHandler(ctx, args)
});

async function getRescheduleBookableRangeBusyWindowsHandler(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): Promise<
	Result<
		{ busyWindowsByMonth: Record<string, BusyDayWindow[]>; timeZone: string },
		| RescheduleLinkLookupError
		| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
		| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
		| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	>
> {
	const [lookupError, result]: RescheduleLinkAndBookingLookupResult = await ctx.runQuery(
		internal.bookingReschedule.getValidRescheduleLinkAndBookingInternal,
		{ now: Date.now(), token: args.token }
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const [rateLimitError] = await checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	try {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const [availabilityError, availability] = await getBookableRangeBusyWindowsFromGoogleCalendar({
			ignoredEvent: {
				calendarId: result.booking.googleCalendarId,
				eventId: result.booking.googleEventId
			},
			settings
		});

		if (availabilityError !== null) {
			return err(availabilityError);
		}

		return ok(availability);
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
}

export type GetRescheduleBookableRangeBusyWindowsResult = Awaited<
	ReturnType<typeof getRescheduleBookableRangeBusyWindowsHandler>
>;

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
		const calendarAvailableTimes = getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: result.booking.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			timeZone
		});
		const now = Date.now();
		const times = calendarAvailableTimes.filter((time) => {
			const [availabilityError] = checkBookingMeetsAvailabilitySettings({
				date: args.date,
				duration: result.booking.duration,
				now,
				settings,
				time,
				timeZone
			});

			if (availabilityError !== null) {
				return false;
			}

			return true;
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

type RescheduleBookingArgs = { date: string; time: string; token: string };

export const rescheduleBooking = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: (ctx, args) => rescheduleBookingHandler(ctx, args)
});

async function rescheduleBookingHandler(
	ctx: ActionCtx,
	args: RescheduleBookingArgs
): Promise<
	Result<
		{ bookingId: Id<"bookings">; warning?: "INVOICE_SEND_FAILED" },
		| RescheduleLinkLookupError
		| AdminBookingUpdateError
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	>
> {
	// Check that the reschedule link still exists, has not expired, and belongs to a booking.
	const now = Date.now();
	const [lookupError, result]: RescheduleLinkAndBookingLookupResult = await ctx.runQuery(
		internal.bookingReschedule.getValidRescheduleLinkAndBookingInternal,
		{ now, token: args.token }
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const [rateLimitError] = await checkBookingSubmitRateLimit(
		ctx,
		getBookingSubmitRateLimitKey(result.booking.email)
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	// Load the booking, Google Calendar client, and booking settings needed to move the event.
	const { booking, link } = result;
	const calendarClient = getGoogleCalendarClient();
	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	// Check the new time before temporarily locking the reschedule link.
	const [timingValidationError] = await validateBookingTimingEdit({
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		existing: {
			date: booking.date,
			duration: booking.duration,
			googleCalendarId: booking.googleCalendarId,
			googleEventId: booking.googleEventId,
			time: booking.time
		},
		next: { date: args.date, duration: booking.duration, time: args.time },
		settings,
		timeZone: calendarClient.timeZone
	});

	if (timingValidationError !== null) {
		return err(timingValidationError);
	}

	// Lock the link so two requests cannot reschedule the booking at the same time.
	const lockedAt = Date.now();
	const [lockError] = await ctx.runMutation(internal.bookingReschedule.lockRescheduleLinkInternal, {
		linkId: link._id,
		now: lockedAt
	});

	if (lockError !== null) {
		return err(lockError);
	}

	const [startError, targetSessionStartAt] = getBookingSessionStartAt(
		args.date,
		args.time,
		calendarClient.timeZone
	);
	if (startError !== null) {
		await ctx.runMutation(internal.bookingReschedule.unlockRescheduleLinkInternal, {
			linkId: link._id,
			lockedAt
		});
		return err(startError);
	}

	// Reserve before moving the Calendar event so every booking flow sees this target.
	const [reservationError, reservationResult] = await ctx.runMutation(
		internal.bookings.reserveBookingSlot,
		{
			bookingId: booking._id,
			duration: booking.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: targetSessionStartAt
		}
	);
	if (reservationError !== null || reservationResult.outcome === "unavailable") {
		await ctx.runMutation(internal.bookingReschedule.unlockRescheduleLinkInternal, {
			linkId: link._id,
			lockedAt
		});
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}
	const timeLock = reservationResult.reservation;

	// Move the booking to the requested date and time in Google Calendar first.
	const [timingUpdateError, timingUpdate] = await updateBookingTimingWithGoogleCalendar({
		booking,
		client: calendarClient,
		date: args.date,
		details: {
			addons: booking.addons,
			duration: booking.duration,
			email: booking.email,
			name: booking.name,
			service: booking.service
		},
		duration: booking.duration,
		createMissingEvent: booking.status === "failed",
		settings,
		time: args.time
	});

	if (timingUpdateError !== null) {
		await ctx.runMutation(internal.bookings.clearBookingSlotReservation, {
			bookingId: booking._id,
			timeLock
		});
		// Unlock the link so the customer can retry after a Calendar failure.
		await ctx.runMutation(internal.bookingReschedule.unlockRescheduleLinkInternal, {
			linkId: link._id,
			lockedAt
		});
		return err(timingUpdateError);
	}

	// Save the new booking time and any Google Calendar ids returned by the update to Convex
	const sessionStartAt = timingUpdate.sessionStartAt;
	const googleCalendarId = timingUpdate.googleCalendarId;
	const googleEventId = timingUpdate.googleEventId;

	const [saveError] = await ctx.runMutation(internal.bookings.saveClientBookingRescheduleInternal, {
		bookingId: booking._id,
		date: args.date,
		time: args.time,
		sessionStartAt,
		confirmBooking: booking.status === "failed",
		timeLock,
		...(googleCalendarId ? { googleCalendarId } : {}),
		...(googleEventId ? { googleEventId } : {})
	});

	if (saveError !== null) {
		await ctx.runMutation(internal.bookings.clearBookingSlotReservation, {
			bookingId: booking._id,
			timeLock
		});
		// Unlock the link so the customer can retry after a save failure.
		await ctx.runMutation(internal.bookingReschedule.unlockRescheduleLinkInternal, {
			linkId: link._id,
			lockedAt
		});
		return err(saveError);
	}

	const updatedBooking = {
		...booking,
		date: args.date,
		time: args.time,
		sessionStartAt,
		googleCalendarId: googleCalendarId ?? booking.googleCalendarId,
		googleEventId: googleEventId ?? booking.googleEventId
	};

	// Unlock the link after the move so the customer can use it again.
	await ctx.runMutation(internal.bookingReschedule.unlockRescheduleLinkInternal, {
		linkId: link._id,
		lockedAt,
		expiresAt: sessionStartAt
	});

	const [emailError] = await sendBookingInvoiceEmailsForBooking(updatedBooking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl: getRescheduleUrlForToken(args.token)
	});

	if (emailError !== null) {
		return ok({ bookingId: booking._id, warning: "INVOICE_SEND_FAILED" });
	}

	return ok({ bookingId: booking._id });
}

export type RescheduleBookingResult = Awaited<ReturnType<typeof rescheduleBookingHandler>>;

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
		notes: v.optional(v.string()),
		remainingBalanceAmount: v.optional(v.number())
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
	const settings = await ctx.runQuery(api.bookingSettings.get, {});

	if (linkError !== null) {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(booking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl
	});

	if (emailError !== null) {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	// Known edge case: the email can send successfully, then this final Convex write can fail.
	// A retry creates a new link, which makes the link in the first email stop working.
	// We accept this because it needs a very specific failure after the email is already sent,
	// and the admin can send the customer the newest email/link if it ever happens.
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

async function deleteBookingFromAdminHandler(
	ctx: ActionCtx,
	args: DeleteBookingFromAdminArgs
): Promise<DeleteBookingFromAdminResult> {
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
		const [statusUpdateError]: MarkBookingCalendarEventDeletedResult = await ctx.runMutation(
			internal.bookings.markBookingCalendarEventDeleted,
			{ bookingId: args.bookingId }
		);

		if (statusUpdateError !== null) {
			return err(statusUpdateError);
		}
	} catch {
		return err({ reason: "BOOKING_STATUS_UPDATE_FAILED" });
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

		const [reminderEmailError] = await sendBookingReminderEmailForBookingRecord(ctx, claim.booking);

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

type ReserveBookingSlotResult = Result<
	{ outcome: "unavailable" } | { outcome: "reserved"; reservation: BookingTimeLock },
	{ reason: "BOOKING_NOT_FOUND" }
>;

type MarkBookingCompletedResult = Result<
	{ updated: true },
	{ reason: "BOOKING_NOT_FOUND" } | { reason: "BOOKING_RESERVATION_MISMATCH" }
>;

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

	// Atomically reserve the window so concurrent payment completions cannot both create events.
	const [reservationError, reservation]: ReserveBookingSlotResult = await ctx.runMutation(
		internal.bookings.reserveBookingSlot,
		{
			bookingId: booking._id,
			duration: booking.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: booking.sessionStartAt
		}
	);

	if (reservationError !== null || reservation.outcome === "unavailable") {
		await failBookingCompletion(ctx, booking._id, "BOOKING_TIME_UNAVAILABLE");
		return ok({ completed: false, outcome: "booking_time_unavailable" });
	}

	const timeLock = reservation.reservation;
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
		await failBookingCompletion(ctx, booking._id, "BOOKING_INVALID_INPUT", timeLock);
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
		await failBookingCompletion(ctx, booking._id, "GOOGLE_CALENDAR_CREATE_FAILED", timeLock);

		return ok({ completed: false, outcome: "google_calendar_create_failed" });
	}

	const [completionError]: MarkBookingCompletedResult = await ctx.runMutation(
		internal.bookings.markBookingCompleted,
		{ bookingId: booking._id, googleEventId, googleCalendarId: calendarClient.calendarId, timeLock }
	);
	if (completionError !== null) {
		return ok({ completed: false, outcome: "reservation_lost" as const });
	}

	// Known edge case: see convex/googleCalendar.ts:573.
	const [linkError, rescheduleUrl] = await createRescheduleUrlForBooking(ctx, booking);

	if (linkError !== null) {
		console.error("Booking invoice reschedule link create failed", {
			bookingId: booking._id,
			reason: linkError.reason
		});
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
		return ok({ completed: true, outcome: "completed" });
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(booking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl
	});

	if (emailError !== null) {
		console.error("Booking invoice email failed during booking completion", {
			bookingId: booking._id,
			reason: emailError.reason
		});
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
	}

	return ok({ completed: true, outcome: "completed" });
}

export type CompleteClaimedBookingResult = Awaited<
	ReturnType<typeof completeClaimedBookingHandler>
>;
