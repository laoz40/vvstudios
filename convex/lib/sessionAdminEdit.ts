import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import type { BookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { fromConvexTuple } from "#convex/lib/result";
import type { SessionReservation } from "./sessionReservations";
import {
	checkSessionMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
	isTimeSlotAvailable,
	type SessionAvailabilitySettings,
	type SessionTimeParseError
} from "./sessionCalendarTime";
import { getBusyWindows } from "./googleCalendarAvailability";
import {
	buildSessionCalendarEventPayload,
	removeOrphanedSessionCalendarEvent,
	type SessionCalendarEventDetails,
	type SessionCalendarTimingUpdateResult,
	updateSessionCalendarEventTiming
} from "./sessionCalendarEvents";
import { getGoogleCalendarErrorCode } from "./googleCalendarErrors";

type SessionEditValues = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: string[];
	notes?: string;
	remainingBalanceAmount?: number;
} & BookingAddonQuantitiesArgs;

export function getSessionStartAt(
	date: string,
	time: string,
	timeZone: string
): Result<number, Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>> {
	return getUtcDateForZonedDateTime(date, time, timeZone).map((startDate) => startDate.getTime());
}

type SessionEditField = keyof SessionEditValues;

const sessionEditFieldNames: Record<SessionEditField, null> = {
	abn: null,
	accountName: null,
	addons: null,
	clipsPackageQuantity: null,
	completeEditQuantity: null,
	date: null,
	duration: null,
	email: null,
	essentialEditQuantity: null,
	handcraftedClipsQuantity: null,
	name: null,
	notes: null,
	phone: null,
	remainingBalanceAmount: null,
	service: null,
	time: null
};

function isSessionEditField(field: string): field is SessionEditField {
	return Object.hasOwn(sessionEditFieldNames, field);
}

// Timing field changes need availability checks.
const sessionTimingFields: readonly SessionEditField[] = ["date", "time", "duration"];
// Google event field changes will later update the calendar event.
const sessionGoogleEventFields: readonly SessionEditField[] = [
	"name",
	"email",
	"service",
	"addons",
	"date",
	"time",
	"duration",
	"essentialEditQuantity",
	"completeEditQuantity",
	"clipsPackageQuantity",
	"handcraftedClipsQuantity",
	"notes"
];
// Pricing field changes may recalculate the remaining balance.
const sessionPricingFields: readonly SessionEditField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"completeEditQuantity",
	"clipsPackageQuantity",
	"handcraftedClipsQuantity"
];

type SessionFieldChangeSummary = {
	changedFields: SessionEditField[];
	timingFieldsChanged: boolean;
	googleEventFieldsChanged: boolean;
	pricingFieldsChanged: boolean;
};

// Compare one editable field from the saved session with the admin's draft.
// Addons are arrays, so compare their contents instead of the array objects.
function didSessionEditFieldChange(
	session: Doc<"bookings">,
	values: SessionEditValues,
	field: SessionEditField
) {
	const currentValue = session[field];
	const nextValue = values[field];

	if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
		if (currentValue.length !== nextValue.length) {
			return true;
		}

		return currentValue.some((value, index) => value !== nextValue[index]);
	}

	return (currentValue ?? undefined) !== (nextValue ?? undefined);
}

// Build summary of what changed
export function getSessionEditFieldChanges(
	session: Doc<"bookings">,
	values: SessionEditValues
): SessionFieldChangeSummary {
	const valueFields = Object.keys(values).filter(isSessionEditField);
	const changedFields = valueFields.filter((field) =>
		didSessionEditFieldChange(session, values, field)
	);

	return {
		changedFields,
		timingFieldsChanged: sessionTimingFields.some((field) => changedFields.includes(field)),
		googleEventFieldsChanged: sessionGoogleEventFields.some((field) =>
			changedFields.includes(field)
		),
		pricingFieldsChanged: sessionPricingFields.some((field) => changedFields.includes(field))
	};
}

export function calculateSessionRemainingBalanceAmount(
	values: Pick<SessionEditValues, "addons" | "duration"> & BookingAddonQuantitiesArgs
) {
	return calculateBookingInvoiceAmounts({
		duration: values.duration,
		addons: values.addons,
		...(values as BookingAddonQuantities)
	}).totalDueAmount;
}

export function isValidSessionRemainingBalanceAmount(amount?: number) {
	return amount === undefined || (Number.isFinite(amount) && amount >= 0);
}

export function buildAdminSessionUpdatePatch({
	session,
	timeZone,
	values
}: {
	session: Doc<"bookings">;
	timeZone: string;
	values: SessionEditValues;
}) {
	if (!isValidSessionRemainingBalanceAmount(values.remainingBalanceAmount)) {
		return err({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	const changes = getSessionEditFieldChanges(session, values);
	const scheduleChanged = changes.timingFieldsChanged;

	return getSessionStartAt(values.date, values.time, timeZone).map((sessionStartAt) => ({
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.email.trim().toLowerCase(),
		date: values.date,
		time: values.time,
		duration: values.duration,
		remainingBalanceAmount:
			values.remainingBalanceAmount ?? calculateSessionRemainingBalanceAmount(values),
		sessionStartAt,
		service: values.service,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		completeEditQuantity: values.completeEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
		handcraftedClipsQuantity: values.handcraftedClipsQuantity,
		notes: values.notes,
		...(scheduleChanged
			? {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined
				}
			: {})
	}));
}

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface VerifySessionCanBeScheduledArgs {
	session: Doc<"bookings">;
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	settings: SessionAvailabilitySettings;
	timeZone: string;
}

type SessionTimingValues = Pick<Doc<"bookings">, "date" | "duration" | "time">;

interface ExistingSessionTiming extends SessionTimingValues {
	googleCalendarId?: string;
	googleEventId?: string;
}

interface ValidateSessionTimingEditArgs {
	bypassAvailabilitySettings?: boolean;
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	existing: ExistingSessionTiming;
	next: SessionTimingValues;
	settings: SessionAvailabilitySettings;
	timeZone: string;
}

export function failBookingConfirmation(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	failureCode: string,
	reservation?: SessionReservation
) {
	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.markBookingConfirmationFailed, {
			bookingId,
			failureCode,
			...(reservation ? { reservation } : {})
		})
	);
}

export async function verifySessionCanBeScheduled({
	session,
	calendar,
	calendarIds,
	settings,
	timeZone
}: VerifySessionCanBeScheduledArgs) {
	const availabilityResult = checkSessionMeetsAvailabilitySettings({
		date: session.date,
		duration: session.duration,
		settings,
		time: session.time,
		timeZone
	});

	if (availabilityResult.isErr()) {
		return false;
	}

	const busyWindows = await getBusyWindows({ calendar, calendarIds, date: session.date, timeZone });

	return isTimeSlotAvailable({
		busyWindows,
		date: session.date,
		duration: session.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		time: session.time,
		timeZone
	});
}

export type AdminSessionUpdateError =
	| { reason: "BOOKING_INVALID_DATE" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_INVALID_TIME" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_CREATE_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "GOOGLE_CALENDAR_UPDATE_FAILED" };

export function validateSessionTimingEdit({
	bypassAvailabilitySettings = false,
	calendar,
	calendarIds,
	existing,
	next,
	settings,
	timeZone
}: ValidateSessionTimingEditArgs) {
	if (!didSessionTimingChange(existing, next)) {
		return okAsync(null);
	}

	const settingsResult = bypassAvailabilitySettings
		? ok(null)
		: checkSessionMeetsAvailabilitySettings({
				date: next.date,
				duration: next.duration,
				settings,
				time: next.time,
				timeZone
			}).mapErr(() => ({ reason: "BOOKING_TIME_UNAVAILABLE" as const }));

	return settingsResult.asyncAndThen(() =>
		ResultAsync.fromPromise(
			getBusyWindows({
				calendar,
				calendarIds,
				date: next.date,
				ignoredEvent: { calendarId: existing.googleCalendarId, eventId: existing.googleEventId },
				timeZone
			}).then((busyWindows) =>
				isTimeSlotAvailable({
					busyWindows,
					date: next.date,
					duration: next.duration,
					eventBufferMinutes: settings.eventBufferMinutes,
					time: next.time,
					timeZone
				})
			),
			(error) => ({
				reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
			})
		).andThen((isAvailable) =>
			isAvailable ? ok(null) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		)
	);
}

function didSessionTimingChange(existing: SessionTimingValues, next: SessionTimingValues) {
	return (
		existing.date !== next.date ||
		existing.time !== next.time ||
		existing.duration !== next.duration
	);
}

export type AdminSessionUpdateArgs = SessionEditValues & { bookingId: Id<"bookings"> };

export type AdminSessionUpdateResult = {
	googleOutcome?: "createdFromFailed" | "replacementCreated";
};

export interface AdminSessionGoogleCalendarClient {
	calendar: GoogleCalendarLike;
	calendarId: string;
	calendarIds: string[];
	timeZone: string;
}

function getAdminSessionEventDetails(args: AdminSessionUpdateArgs) {
	return {
		addons: args.addons,
		duration: args.duration,
		email: args.email,
		name: args.name,
		service: args.service
	};
}

function promoteFailedSessionFromAdmin({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Failed bookings are only promoted when the edited time is valid and available.
	return ResultAsync.fromSafePromise(
		verifySessionCanBeScheduled({
			session: { ...session, date: args.date, duration: args.duration, time: args.time },
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			settings,
			timeZone: client.timeZone
		})
	).andThen((canBeScheduled) => {
		if (!canBeScheduled) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
		}

		// Create the Calendar event before saving so Google failures block the Convex update.
		return ResultAsync.fromPromise(
			Promise.resolve().then(() =>
				buildSessionCalendarEventPayload({
					date: args.date,
					details: getAdminSessionEventDetails(args),
					time: args.time,
					timeZone: client.timeZone
				})
			),
			(error) => ({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED") })
		)
			.andThen((payloadResult) =>
				payloadResult.mapErr(() => ({ reason: "BOOKING_INVALID_INPUT" as const }))
			)
			.andThen((requestBody) =>
				ResultAsync.fromPromise(
					client.calendar.events.insert({
						calendarId: client.calendarId,
						sendUpdates: "all",
						requestBody
					}),
					(error) => ({
						reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED")
					})
				)
			)
			.andThen((createdEvent) => {
				const googleEventId = createdEvent.data.id ?? undefined;

				// Promote to confirmed and clear the previous failure code in the save mutation.
				return fromConvexTuple(
					ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
						...args,
						confirmBooking: true,
						googleCalendarId: client.calendarId,
						googleEventId,
						...(reservation ? { reservation } : {})
					})
				).orElse((saveError) => {
					const shouldRemoveOrphanedEvent =
						saveError.reason === "BOOKING_TIME_UNAVAILABLE" ||
						saveError.reason === "BOOKING_NOT_FOUND";
					if (!shouldRemoveOrphanedEvent || googleEventId === undefined) {
						return err(saveError);
					}

					return ResultAsync.fromSafePromise(
						removeOrphanedSessionCalendarEvent({
							bookingId: session._id,
							calendar: client.calendar,
							calendarId: client.calendarId,
							googleEventId
						})
					).andThen(() => err(saveError));
				});
			})
			.map(() => ({ googleOutcome: "createdFromFailed" as const }));
	});
}

export function updateSessionTimingWithGoogleCalendar({
	bypassAvailabilitySettings = false,
	session,
	client,
	date,
	details,
	duration,
	createMissingEvent = false,
	settings,
	time
}: {
	bypassAvailabilitySettings?: boolean;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	date: string;
	details: SessionCalendarEventDetails;
	duration: string;
	createMissingEvent?: boolean;
	settings: SessionAvailabilitySettings;
	time: string;
}): ResultAsync<
	SessionCalendarTimingUpdateResult & { sessionStartAt: number },
	AdminSessionUpdateError
> {
	return getSessionStartAt(date, time, client.timeZone).asyncAndThen((sessionStartAt) =>
		validateSessionTimingEdit({
			bypassAvailabilitySettings,
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			existing: {
				date: session.date,
				duration: session.duration,
				googleCalendarId: session.googleCalendarId,
				googleEventId: session.googleEventId,
				time: session.time
			},
			next: { date, duration, time },
			settings,
			timeZone: client.timeZone
		})
			.andThen(() =>
				ResultAsync.fromSafePromise(
					updateSessionCalendarEventTiming({
						session,
						client,
						date,
						details,
						createMissingEvent,
						time
					})
				).andThen((calendarResult) => calendarResult)
			)
			.map((calendarUpdate) => ({ ...calendarUpdate, sessionStartAt }))
	);
}

function updateConfirmedSessionGoogleEventOrCreateReplacement({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}): ResultAsync<AdminSessionUpdateResult | null, AdminSessionUpdateError> {
	return updateSessionTimingWithGoogleCalendar({
		bypassAvailabilitySettings: true,
		session,
		client,
		date: args.date,
		details: getAdminSessionEventDetails(args),
		duration: args.duration,
		settings,
		time: args.time
	}).andThen((timingUpdate) => {
		if (!timingUpdate.googleEventId && !timingUpdate.googleCalendarId) {
			return ok(null);
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
				...args,
				googleCalendarId: timingUpdate.googleCalendarId,
				googleEventId: timingUpdate.googleEventId,
				...(reservation ? { reservation } : {})
			})
		).map(() => ({ googleOutcome: timingUpdate.outcome }));
	});
}

export function updateSessionFromAdminWithGoogleCalendar({
	args,
	session,
	client,
	ctx,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	settings: SessionAvailabilitySettings;
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Updates that do not move the session do not need a slot reservation.
	if (!didSessionTimingChange(session, args)) {
		return applyAdminSessionUpdate({ args, session, client, ctx, settings });
	}

	// Convert the requested date and time, then reserve it before updating Convex or Google Calendar.
	return getSessionStartAt(args.date, args.time, client.timeZone).asyncAndThen((sessionStartAt) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
				bookingId: session._id,
				duration: args.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
				now: Date.now(),
				sessionStartAt
			})
		)
			.mapErr(() => ({ reason: "BOOKING_TIME_UNAVAILABLE" as const }))
			.andThen((reservationResult) => {
				if (reservationResult.outcome === "unavailable") {
					return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
				}

				// Pass the reservation through so the save can prove it owns the time.
				const reservation = reservationResult.reservation;
				return applyAdminSessionUpdate({
					args,
					session,
					client,
					ctx,
					reservation,
					settings
				}).orElse((error) =>
					// Release the reservation if any part of the update fails.
					ResultAsync.fromSafePromise(
						ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
							bookingId: session._id,
							reservation
						})
					).andThen(() => err(error))
				);
			})
	);
}

function applyAdminSessionUpdate({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Failed checkouts have no Calendar event, so an admin edit creates one and confirms the session.
	if (session.status === "failed") {
		return promoteFailedSessionFromAdmin({ args, session, client, ctx, reservation, settings });
	}

	// Pending, expired, and abandoned bookings save in Convex only; no Google event sync.
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return validateSessionTimingEdit({
			bypassAvailabilitySettings: true,
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			existing: {
				date: session.date,
				duration: session.duration,
				googleCalendarId: session.googleCalendarId,
				googleEventId: session.googleEventId,
				time: session.time
			},
			next: { date: args.date, duration: args.duration, time: args.time },
			settings,
			timeZone: client.timeZone
		})
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
						...args,
						...(reservation ? { reservation } : {})
					})
				)
			)
			.map(() => ({}));
	}

	// Update the linked Google event. If it is missing/cancelled, this creates and saves a replacement.
	return updateConfirmedSessionGoogleEventOrCreateReplacement({
		args,
		session,
		client,
		ctx,
		reservation,
		settings
	}).andThen((replacementOutcome) => {
		if (replacementOutcome) {
			return ok(replacementOutcome);
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
				...args,
				...(reservation ? { reservation } : {})
			})
		).map(() => ({}));
	});
}
