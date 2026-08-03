"use node";

import { v } from "convex/values";
import { ResultAsync } from "neverthrow";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internal } from "./_generated/api";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import {
	type BusyDayWindow,
	type SessionAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay
} from "./lib/sessionCalendarTime";
import { type AdminSessionUpdateArgs } from "./lib/sessionAdminEdit";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { checkGoogleCalendarAvailabilityRateLimit } from "./lib/rateLimits";
import { getBookingSettingsService } from "./services/bookingSettings";
import { fromConvexTuple } from "./lib/result";
import {
	deleteSessionFromAdminService,
	getAvailableRescheduleTimesService,
	rescheduleSessionService,
	type GetAvailableRescheduleTimesError,
	updateSessionFromAdminService,
	type RescheduleSessionArgs
} from "./services/sessionCalendar";
import {
	completeClaimedSessionService,
	sendBookingInvoiceForBookingService,
	sendSessionReminderEmailService,
	type SendBookingInvoiceForBookingArgs
} from "./services/bookingConfirmationActions";

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };
type IgnoredBusyEvent = { calendarId?: string; eventId?: string };
type GoogleCalendarAvailabilityError = {
	reason:
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

function mapGoogleCalendarAvailabilityError(error: unknown): GoogleCalendarAvailabilityError {
	return { reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED") };
}

function getBookableRangeBusyWindowsFromGoogleCalendar({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => getGoogleCalendarClient()),
		mapGoogleCalendarAvailabilityError
	).andThen(({ calendar, calendarIds, timeZone }) => {
		const today = startOfToday();
		const startDate = formatDateValue(today);
		const endDate = formatDateValue(getLastBookableDate(today, settings.maxDaysAhead));

		return getDateAvailabilityRange(startDate, endDate, timeZone)
			.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
			.asyncAndThen(({ timeMin, timeMax }) =>
				ResultAsync.fromPromise(
					getBusyWindowsInRange({
						calendar,
						calendarIds,
						ignoredEvent,
						timeMax,
						timeMin,
						timeZone
					}),
					mapGoogleCalendarAvailabilityError
				).andThen((busyWindows) =>
					groupBusyWindowsByDay(busyWindows, timeZone)
						.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
						.map((busyDays) => ({ busyWindowsByMonth: groupBusyDaysByMonth(busyDays), timeZone }))
				)
			);
	});
}

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: (ctx, args) => getBookableRangeBusyWindowsHandler(ctx, args)
});

async function getBookableRangeBusyWindowsHandler(ctx: ActionCtx, args: { rateLimitKey: string }) {
	return await checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
		.andThen(() => {
			return getBookingSettingsService(ctx);
		})
		.andThen((settings) => getBookableRangeBusyWindowsFromGoogleCalendar({ settings }))
		.match(tupleOk, tupleErr);
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
	return await getBookingSettingsService(ctx)
		.andThen((settings) =>
			ResultAsync.fromPromise(
				Promise.resolve().then(() => getGoogleCalendarClient()),
				mapGoogleCalendarAvailabilityError
			).andThen(({ calendar, calendarIds, timeZone }) =>
				ResultAsync.fromPromise(
					getBusyWindows({ calendar, calendarIds, date: args.date, timeZone }),
					mapGoogleCalendarAvailabilityError
				).map((busyWindows) => ({
					timeZone,
					times: getAvailableTimeOptions({
						busyWindows,
						date: args.date,
						duration: args.duration,
						eventBufferMinutes: settings.eventBufferMinutes,
						timeZone
					})
				}))
			)
		)
		.match(tupleOk, tupleErr);
}

export type GetAvailableBookingTimesResult = Awaited<
	ReturnType<typeof getAvailableBookingTimesHandler>
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
		GetAvailableRescheduleTimesError
	>
> {
	return await fromConvexTuple(
		ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
			now: Date.now(),
			token: args.token
		})
	)
		.andThen((result) =>
			checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey).map(() => result)
		)
		.andThen((result) => getBookingSettingsService(ctx).map((settings) => ({ result, settings })))
		.andThen(({ result, settings }) =>
			getBookableRangeBusyWindowsFromGoogleCalendar({
				ignoredEvent: {
					calendarId: result.session.googleCalendarId,
					eventId: result.session.googleEventId
				},
				settings
			})
		)
		.match(tupleOk, tupleErr);
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
	args: { date: string; token: string }
): Promise<Result<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError>> {
	return await getAvailableRescheduleTimesService(ctx, args).match(tupleOk, tupleErr);
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
	return (await sendBookingInvoiceForBookingService(ctx, args)).match(tupleOk, tupleErr);
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
	handler: async (ctx, args) =>
		(await sendSessionReminderEmailService(ctx, args)).match(tupleOk, tupleErr)
});

export const completeClaimedSession = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => completeClaimedSessionHandler(ctx, args)
});

async function completeClaimedSessionHandler(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return (await completeClaimedSessionService(ctx, args)).match(tupleOk, tupleErr);
}

export type CompleteClaimedSessionResult = Awaited<
	ReturnType<typeof completeClaimedSessionHandler>
>;
