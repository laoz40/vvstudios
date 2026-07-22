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
import { createRescheduleUrlForSession } from "./sessionReschedule";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { getAdminIdentity } from "./lib/auth";
import { getSessionFromQuery } from "./lib/sessionLookup";
import {
	buildEventWindow,
	type SessionAvailabilitySettings,
	type BusyDayWindow,
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay
} from "./lib/sessionCalendarTime";
import {
	sendBookingInvoiceEmailsForBooking,
	sendSessionReminderEmail as sendReminderEmailForBookingDetails
} from "./lib/email";
import {
	failSessionCompletion,
	getSessionStartAt,
	isValidSessionRemainingBalanceAmount,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult,
	validateSessionTimingEdit,
	verifySessionCanBeScheduled,
	updateSessionFromAdminWithGoogleCalendar,
	updateSessionTimingWithGoogleCalendar
} from "./lib/sessionAdminEdit";
import {
	buildSessionCalendarEventPayload,
	deleteSessionCalendarEvent
} from "./lib/sessionCalendarEvents";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import {
	checkBookingSubmitRateLimit,
	checkGoogleCalendarAvailabilityRateLimit
} from "./lib/rateLimits";
import type { RescheduleLinkLookupError } from "./sessionReschedule";
import type { MarkSessionCalendarEventDeletedResult } from "./sessionCompletion";
import type { SessionReservation } from "./lib/sessionReservations";
import { saveCompletedSession, sendCompletedBookingInvoice } from "./lib/sessionCompletion";
import { finishRescheduledSession } from "./lib/sessionRescheduleLinks";

function getBookingSubmitRateLimitKey(email: string) {
	return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

type SendBookingInvoiceForBookingArgs = {
	bookingId: Id<"bookings">;
	customInvoiceId?: Id<"customInvoices">;
};

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };
export type DeleteSessionFromAdminResult = Result<
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
	settings: SessionAvailabilitySettings;
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

async function sendBookingReminderEmailForSessionRecord(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();
	const [windowError, eventWindow] = buildEventWindow(
		session.date,
		session.time,
		session.duration,
		timeZone
	);

	if (windowError !== null) {
		return err(windowError);
	}

	const { startDateTime } = eventWindow;

	let rescheduleUrl: string | undefined;

	if (session.multiBookingPackageId === undefined) {
		const [linkError, sessionRescheduleUrl] = await createRescheduleUrlForSession(ctx, session);

		if (linkError !== null) {
			return err({ reason: "RESCHEDULE_LINK_CREATE_FAILED" });
		}

		rescheduleUrl = sessionRescheduleUrl;
	}

	const [emailError] = await sendReminderEmailForBookingDetails({
		name: session.name,
		email: session.email,
		date: session.date,
		startDateTime,
		time: session.time,
		timeZone,
		service: session.service,
		duration: session.duration,
		addons: session.addons,
		rescheduleUrl,
		isPackageSession: session.multiBookingPackageId !== undefined
	});

	if (emailError !== null) {
		console.error("Booking reminder email send failed", {
			bookingId: session._id,
			bookingEmail: session.email,
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
	{ session: Doc<"bookings">; link: Doc<"bookingRescheduleLinks"> },
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
		internal.sessionReschedule.getValidRescheduleLinkAndSession,
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
				calendarId: result.session.googleCalendarId,
				eventId: result.session.googleEventId
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
		internal.sessionReschedule.getValidRescheduleLinkAndSession,
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
				calendarId: result.session.googleCalendarId,
				eventId: result.session.googleEventId
			},
			timeZone
		});
		const calendarAvailableTimes = getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: result.session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			timeZone
		});
		const now = Date.now();
		const times = calendarAvailableTimes.filter((time) => {
			const [availabilityError] = checkSessionMeetsAvailabilitySettings({
				date: args.date,
				duration: result.session.duration,
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

type RescheduleSessionArgs = { date: string; time: string; token: string };

export const rescheduleSession = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: (ctx, args) => rescheduleSessionHandler(ctx, args)
});

async function rescheduleSessionHandler(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): Promise<
	Result<
		{ bookingId: Id<"bookings">; warning?: "INVOICE_SEND_FAILED" },
		| RescheduleLinkLookupError
		| AdminSessionUpdateError
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	>
> {
	// Check that the reschedule link still exists, has not expired, and belongs to a session.
	const now = Date.now();
	const [lookupError, result]: RescheduleLinkAndBookingLookupResult = await ctx.runQuery(
		internal.sessionReschedule.getValidRescheduleLinkAndSession,
		{ now, token: args.token }
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const [rateLimitError] = await checkBookingSubmitRateLimit(
		ctx,
		getBookingSubmitRateLimitKey(result.session.email)
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	// Load the session, Google Calendar client, and session settings needed to move the event.
	const { session, link } = result;
	const calendarClient = getGoogleCalendarClient();
	const settings: SessionAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	// Check the new time before temporarily locking the reschedule link.
	const [timingValidationError] = await validateSessionTimingEdit({
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		existing: {
			date: session.date,
			duration: session.duration,
			googleCalendarId: session.googleCalendarId,
			googleEventId: session.googleEventId,
			time: session.time
		},
		next: { date: args.date, duration: session.duration, time: args.time },
		settings,
		timeZone: calendarClient.timeZone
	});

	if (timingValidationError !== null) {
		return err(timingValidationError);
	}

	// Lock the link so two requests cannot reschedule the session at the same time.
	const lockedAt = Date.now();
	const [lockError] = await ctx.runMutation(internal.sessionReschedule.lockRescheduleLink, {
		linkId: link._id,
		now: lockedAt
	});

	if (lockError !== null) {
		return err(lockError);
	}

	const [startError, targetSessionStartAt] = getSessionStartAt(
		args.date,
		args.time,
		calendarClient.timeZone
	);
	if (startError !== null) {
		await ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId: link._id,
			lockedAt
		});
		return err(startError);
	}

	// Reserve before moving the Calendar event so every session flow sees this target.
	const [reservationError, reservationResult] = await ctx.runMutation(
		internal.sessionScheduling.reserveSessionReservation,
		{
			bookingId: session._id,
			duration: session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: targetSessionStartAt
		}
	);
	if (reservationError !== null || reservationResult.outcome === "unavailable") {
		await ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId: link._id,
			lockedAt
		});
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}
	const reservation = reservationResult.reservation;

	// Move the session to the requested date and time in Google Calendar first.
	const [timingUpdateError, timingUpdate] = await updateSessionTimingWithGoogleCalendar({
		session,
		client: calendarClient,
		date: args.date,
		details: {
			addons: session.addons,
			duration: session.duration,
			email: session.email,
			name: session.name,
			service: session.service
		},
		duration: session.duration,
		createMissingEvent: session.status === "failed",
		settings,
		time: args.time
	});

	if (timingUpdateError !== null) {
		await ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: session._id,
			reservation
		});
		// Unlock the link so the customer can retry after a Calendar failure.
		await ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId: link._id,
			lockedAt
		});
		return err(timingUpdateError);
	}

	// Save the new session time and any Google Calendar ids returned by the update to Convex
	const sessionStartAt = timingUpdate.sessionStartAt;
	const googleCalendarId = timingUpdate.googleCalendarId;
	const googleEventId = timingUpdate.googleEventId;

	const [saveError] = await ctx.runMutation(
		internal.sessionScheduling.saveClientSessionReschedule,
		{
			bookingId: session._id,
			date: args.date,
			time: args.time,
			sessionStartAt,
			confirmBooking: session.status === "failed",
			reservation,
			...(googleCalendarId ? { googleCalendarId } : {}),
			...(googleEventId ? { googleEventId } : {})
		}
	);

	if (saveError !== null) {
		await ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: session._id,
			reservation
		});
		// Unlock the link so the customer can retry after a save failure.
		await ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId: link._id,
			lockedAt
		});
		return err(saveError);
	}

	// Unlock the link after the move so the customer can use it again.
	await ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
		linkId: link._id,
		lockedAt,
		expiresAt: sessionStartAt
	});

	return finishRescheduledSession(session, args, timingUpdate, settings);
}

export type RescheduleSessionResult = Awaited<ReturnType<typeof rescheduleSessionHandler>>;

type UpdateBookingFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

export const updateSessionFromAdmin = action({
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
	handler: updateSessionFromAdminHandler
});

async function updateSessionFromAdminHandler(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs
): Promise<Result<AdminSessionUpdateResult, UpdateBookingFromAdminError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	if (!isValidSessionRemainingBalanceAmount(args.remainingBalanceAmount)) {
		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	const [bookingError, session] = await getSessionFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	const settings: SessionAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});
	const client = getGoogleCalendarClient();

	return updateSessionFromAdminWithGoogleCalendar({ args, session, client, ctx, settings });
}

export type UpdateSessionFromAdminResult = Awaited<
	ReturnType<typeof updateSessionFromAdminHandler>
>;

export const sendBookingInvoiceForBooking = action({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.optional(v.id("customInvoices")) },
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

	const [bookingError, session] = await getSessionFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	const customInvoice = args.customInvoiceId
		? await ctx.runQuery(internal.customInvoices.getBookingCustomInvoiceSource, {
				bookingId: session._id,
				customInvoiceId: args.customInvoiceId
			})
		: undefined;

	if (args.customInvoiceId && !customInvoice) {
		return err({ reason: "CUSTOM_INVOICE_NOT_FOUND" });
	}

	const [linkError, rescheduleUrl] = await createRescheduleUrlForSession(ctx, session);
	const settings = await ctx.runQuery(api.bookingSettings.get, {});

	if (linkError !== null) {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(session, {
		customInvoice: customInvoice ?? undefined,
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
		await ctx.runMutation(internal.sessionCompletion.markSessionInvoiceEmailSent, {
			bookingId: session._id
		});
	} catch {
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	return ok({ sent: true });
}

export type SendBookingInvoiceForBookingResult = Awaited<
	ReturnType<typeof sendBookingInvoiceForBookingHandler>
>;

export const deleteSessionFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: deleteSessionFromAdminHandler
});

async function deleteSessionFromAdminHandler(
	ctx: ActionCtx,
	args: DeleteBookingFromAdminArgs
): Promise<DeleteSessionFromAdminResult> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, session] = await getSessionFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	const client = getGoogleCalendarClient();
	const [error] = await deleteSessionCalendarEvent({ session, client });

	if (error !== null) {
		return err(error);
	}

	try {
		const [statusUpdateError]: MarkSessionCalendarEventDeletedResult = await ctx.runMutation(
			internal.sessionCompletion.markSessionCalendarEventDeleted,
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

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const now = Date.now();
		const [claimError, claim] = await ctx.runMutation(
			internal.sessionReminders.claimSessionReminderEmail,
			{ bookingId: args.bookingId, now }
		);

		if (claimError !== null) return null;

		const [reminderEmailError] = await sendBookingReminderEmailForSessionRecord(ctx, claim.session);

		if (reminderEmailError !== null) {
			await ctx.runMutation(internal.sessionReminders.markSessionReminderEmailFailed, {
				bookingId: args.bookingId,
				failureCode: reminderEmailError.reason
			});
			return null;
		}

		await ctx.runMutation(internal.sessionReminders.markSessionReminderEmailSent, {
			bookingId: args.bookingId,
			now: Date.now()
		});

		return null;
	}
});

type ReserveBookingResult = Result<
	{ outcome: "unavailable" } | { outcome: "reserved"; reservation: SessionReservation },
	{ reason: "BOOKING_NOT_FOUND" }
>;

export const completeClaimedSession = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => completeClaimedSessionHandler(ctx, args)
});

async function completeClaimedSessionHandler(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	const [bookingError, session] = await getSessionFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	if (!session.bookingConfirmationClaimedAt) {
		return err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" });
	}

	if (session.status === "confirmed" || session.status === "email_failed") {
		return ok({ completed: true, outcome: "already_completed" });
	}

	const settings = await ctx.runQuery(api.bookingSettings.get, {});
	const calendarClient = getGoogleCalendarClient();

	const canBeScheduled = await verifySessionCanBeScheduled({
		session,
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		settings,
		timeZone: calendarClient.timeZone
	});

	if (!canBeScheduled) {
		await failSessionCompletion(ctx, session._id, "BOOKING_TIME_UNAVAILABLE");
		return ok({ completed: false, outcome: "booking_time_unavailable" });
	}

	// Atomically reserve the window so concurrent payment completions cannot both create events.
	const [reservationError, reservationResult]: ReserveBookingResult = await ctx.runMutation(
		internal.sessionScheduling.reserveSessionReservation,
		{
			bookingId: session._id,
			duration: session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: session.sessionStartAt
		}
	);

	if (reservationError !== null || reservationResult.outcome === "unavailable") {
		await failSessionCompletion(ctx, session._id, "BOOKING_TIME_UNAVAILABLE");
		return ok({ completed: false, outcome: "booking_time_unavailable" });
	}

	const reservation = reservationResult.reservation;
	const [payloadError, requestBody] = buildSessionCalendarEventPayload({
		date: session.date,
		time: session.time,
		timeZone: calendarClient.timeZone,
		details: {
			addons: session.addons,
			name: session.name,
			duration: session.duration,
			email: session.email,
			service: session.service
		}
	});

	if (payloadError !== null) {
		await failSessionCompletion(ctx, session._id, "BOOKING_INVALID_INPUT", reservation);
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
		await failSessionCompletion(ctx, session._id, "GOOGLE_CALENDAR_CREATE_FAILED", reservation);

		return ok({ completed: false, outcome: "google_calendar_create_failed" });
	}

	const completionSaved = await saveCompletedSession(
		ctx,
		session,
		calendarClient,
		reservation,
		googleEventId
	);

	if (!completionSaved) {
		return ok({ completed: false, outcome: "reservation_lost" as const });
	}

	await sendCompletedBookingInvoice(ctx, session, settings);
	return ok({ completed: true, outcome: "completed" });
}

export type CompleteClaimedSessionResult = Awaited<
	ReturnType<typeof completeClaimedSessionHandler>
>;
