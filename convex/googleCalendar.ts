"use node";

import { v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk, type Result } from "#/lib/result";
import { api, internal } from "./_generated/api";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";
import { createRescheduleUrlForSession } from "./sessionReschedule";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { getAdminIdentity } from "./lib/auth";
import { getSessionFromQueryResult } from "./lib/sessionLookup";
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
	failBookingConfirmation,
	type AdminSessionUpdateArgs,
	verifySessionCanBeScheduled
} from "./lib/sessionAdminEdit";
import { buildSessionCalendarEventPayload } from "./lib/sessionCalendarEvents";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { checkGoogleCalendarAvailabilityRateLimit } from "./lib/rateLimits";
import type { RescheduleLinkLookupError } from "./sessionReschedule";
import type { SessionReservation } from "./lib/sessionReservations";
import { saveConfirmedBooking, sendConfirmedBookingInvoice } from "./lib/bookingConfirmation";
import {
	deleteSessionFromAdminService,
	rescheduleSessionService,
	updateSessionFromAdminService,
	type RescheduleSessionArgs
} from "./services/sessionCalendar";

type SendBookingInvoiceForBookingArgs = {
	bookingId: Id<"bookings">;
	customInvoiceId?: Id<"customInvoices">;
};

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };
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
	const availabilityRangeResult = getDateAvailabilityRange(startDate, endDate, timeZone);

	if (availabilityRangeResult.isErr()) {
		return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
	}

	const { timeMin, timeMax } = availabilityRangeResult.value;
	const busyWindows = await getBusyWindowsInRange({
		calendar,
		calendarIds,
		ignoredEvent,
		timeMax,
		timeMin,
		timeZone
	});
	return groupBusyWindowsByDay(busyWindows, timeZone).match(
		(busyDays) => ok({ busyWindowsByMonth: groupBusyDaysByMonth(busyDays), timeZone }),
		() => err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" })
	);
}

async function sendBookingReminderEmailForSessionRecord(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();
	const eventWindowResult = buildEventWindow(
		session.date,
		session.time,
		session.duration,
		timeZone
	);

	if (eventWindowResult.isErr()) {
		return err(eventWindowResult.error);
	}

	const { startDateTime } = eventWindowResult.value;

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
		const times = calendarAvailableTimes.filter((time) =>
			checkSessionMeetsAvailabilitySettings({
				date: args.date,
				duration: result.session.duration,
				now,
				settings,
				time,
				timeZone
			}).isOk()
		);

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

export const rescheduleSession = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: (ctx, args) => rescheduleSessionHandler(ctx, args)
});

async function rescheduleSessionHandler(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return await rescheduleSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type RescheduleSessionResult = Awaited<ReturnType<typeof rescheduleSessionHandler>>;

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

async function updateSessionFromAdminHandler(ctx: ActionCtx, args: AdminSessionUpdateArgs) {
	return await updateSessionFromAdminService(ctx, args).match(tupleOk, tupleErr);
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

	const sessionResult = await getSessionFromQueryResult(ctx, args.bookingId);

	if (sessionResult.isErr()) {
		return err(sessionResult.error);
	}
	const session = sessionResult.value;

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
		await ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
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

async function deleteSessionFromAdminHandler(ctx: ActionCtx, args: DeleteBookingFromAdminArgs) {
	return await deleteSessionFromAdminService(ctx, args.bookingId).match(tupleOk, tupleErr);
}

export type DeleteSessionFromAdminResult = Awaited<
	ReturnType<typeof deleteSessionFromAdminHandler>
>;

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const now = Date.now();
		const [claimError, claim] = await ctx.runMutation(internal.sessionReminders.claimReminder, {
			bookingId: args.bookingId,
			now
		});

		if (claimError !== null) return null;

		const [reminderEmailError] = await sendBookingReminderEmailForSessionRecord(ctx, claim.session);

		if (reminderEmailError !== null) {
			await ctx.runMutation(internal.sessionReminders.markReminderFailed, {
				bookingId: args.bookingId,
				failureCode: reminderEmailError.reason
			});
			return null;
		}

		await ctx.runMutation(internal.sessionReminders.markReminderSent, {
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
	const sessionResult = await getSessionFromQueryResult(ctx, args.bookingId);

	if (sessionResult.isErr()) {
		return err(sessionResult.error);
	}
	const session = sessionResult.value;

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
		await failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE");
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
		await failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE");
		return ok({ completed: false, outcome: "booking_time_unavailable" });
	}

	const reservation = reservationResult.reservation;
	const payloadResult = buildSessionCalendarEventPayload({
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

	if (payloadResult.isErr()) {
		await failBookingConfirmation(ctx, session._id, "BOOKING_INVALID_INPUT", reservation);
		return ok({ completed: false, outcome: "booking_invalid_input" });
	}

	const requestBody = payloadResult.value;
	let googleEventId: string | undefined;

	try {
		const createdEvent = await calendarClient.calendar.events.insert({
			calendarId: calendarClient.calendarId,
			sendUpdates: "all",
			requestBody
		});
		googleEventId = createdEvent.data.id ?? undefined;
	} catch {
		await failBookingConfirmation(ctx, session._id, "GOOGLE_CALENDAR_CREATE_FAILED", reservation);

		return ok({ completed: false, outcome: "google_calendar_create_failed" });
	}

	const completionSaved = await saveConfirmedBooking(
		ctx,
		session,
		calendarClient,
		reservation,
		googleEventId
	);

	if (!completionSaved) {
		return ok({ completed: false, outcome: "reservation_lost" as const });
	}

	await sendConfirmedBookingInvoice(ctx, session, settings);
	return ok({ completed: true, outcome: "completed" });
}

export type CompleteClaimedSessionResult = Awaited<
	ReturnType<typeof completeClaimedSessionHandler>
>;
