import { err, ok, type Result } from "#/lib/result";
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err as neverthrowErr, ok as neverthrowOk } from "neverthrow";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { SessionReservation } from "./sessionReservations";
import {
	checkSessionMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
	isTimeSlotAvailable,
	type SessionAvailabilitySettings
} from "./sessionCalendarTime";
import { getBusyWindows } from "./googleCalendarAvailability";
import {
	buildSessionCalendarEventPayload,
	type SessionCalendarEventDetails,
	type SessionCalendarTimingUpdateResult,
	updateSessionCalendarEventTiming
} from "./sessionCalendarEvents";
import { getGoogleCalendarErrorCode } from "./googleCalendarErrors";

type SessionEditValues = Pick<
	Doc<"bookings">,
	"accountName" | "addons" | "date" | "duration" | "email" | "name" | "phone" | "service" | "time"
> & {
	abn?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	remainingBalanceAmount?: number;
	essentialEditQuantity?: string;
};

export function getSessionStartAt(date: string, time: string, timeZone: string) {
	const [startError, startDate] = getUtcDateForZonedDateTime(date, time, timeZone);

	if (startError !== null) {
		return err(startError);
	}

	return ok(startDate.getTime());
}

type SessionEditField = keyof SessionEditValues;

const sessionEditFieldNames: Record<SessionEditField, null> = {
	abn: null,
	accountName: null,
	addons: null,
	clipsPackageQuantity: null,
	date: null,
	duration: null,
	email: null,
	essentialEditQuantity: null,
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
	"clipsPackageQuantity",
	"notes"
];
// Pricing field changes may recalculate the remaining balance.
const sessionPricingFields: readonly SessionEditField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity"
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
	values: Pick<
		SessionEditValues,
		"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
	>
) {
	return calculateBookingInvoiceAmounts({
		duration: values.duration,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity
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
		return neverthrowErr({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	const changes = getSessionEditFieldChanges(session, values);
	const scheduleChanged = changes.timingFieldsChanged;

	const [sessionStartError, sessionStartAt] = getSessionStartAt(values.date, values.time, timeZone);

	if (sessionStartError !== null) {
		return neverthrowErr(sessionStartError);
	}

	return neverthrowOk({
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.email,
		date: values.date,
		time: values.time,
		duration: values.duration,
		remainingBalanceAmount:
			values.remainingBalanceAmount ?? calculateSessionRemainingBalanceAmount(values),
		sessionStartAt,
		service: values.service,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
		notes: values.notes,
		...(scheduleChanged
			? {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined
				}
			: {})
	});
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

export async function failBookingConfirmation(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	failureCode: string,
	reservation?: SessionReservation
) {
	await ctx.runMutation(internal.bookingConfirmation.markBookingConfirmationFailed, {
		bookingId,
		failureCode,
		...(reservation ? { reservation } : {})
	});
}

export async function verifySessionCanBeScheduled({
	session,
	calendar,
	calendarIds,
	settings,
	timeZone
}: VerifySessionCanBeScheduledArgs) {
	const [availabilityError] = checkSessionMeetsAvailabilitySettings({
		date: session.date,
		duration: session.duration,
		settings,
		time: session.time,
		timeZone
	});

	if (availabilityError !== null) {
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

export async function validateSessionTimingEdit({
	bypassAvailabilitySettings = false,
	calendar,
	calendarIds,
	existing,
	next,
	settings,
	timeZone
}: ValidateSessionTimingEditArgs) {
	if (!didSessionTimingChange(existing, next)) {
		return ok({ valid: true });
	}

	try {
		if (!bypassAvailabilitySettings) {
			const [availabilityError] = checkSessionMeetsAvailabilitySettings({
				date: next.date,
				duration: next.duration,
				settings,
				time: next.time,
				timeZone
			});

			if (availabilityError !== null) {
				return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
			}
		}

		const busyWindows = await getBusyWindows({
			calendar,
			calendarIds,
			date: next.date,
			ignoredEvent: { calendarId: existing.googleCalendarId, eventId: existing.googleEventId },
			timeZone
		});

		const isAvailable = isTimeSlotAvailable({
			busyWindows,
			date: next.date,
			duration: next.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			time: next.time,
			timeZone
		});

		if (!isAvailable) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		return ok({ valid: true });
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
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
	ok: true;
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

async function promoteFailedSessionFromAdmin({
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
}): Promise<Result<AdminSessionUpdateResult, AdminSessionUpdateError>> {
	// Failed bookings are only promoted when the edited time is valid and available.
	const canBeScheduled = await verifySessionCanBeScheduled({
		session: { ...session, date: args.date, duration: args.duration, time: args.time },
		calendar: client.calendar,
		calendarIds: client.calendarIds,
		settings,
		timeZone: client.timeZone
	});

	if (!canBeScheduled) {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}

	// Create the Calendar event before saving so Google failures block the Convex update.
	let googleEventId: string | undefined;
	try {
		const [payloadError, requestBody] = buildSessionCalendarEventPayload({
			date: args.date,
			details: getAdminSessionEventDetails(args),
			time: args.time,
			timeZone: client.timeZone
		});

		if (payloadError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" });
		}

		const createdEvent = await client.calendar.events.insert({
			calendarId: client.calendarId,
			sendUpdates: "all",
			requestBody
		});
		googleEventId = createdEvent.data.id ?? undefined;
	} catch (error) {
		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED") });
	}

	// Promote to confirmed and clear the previous failure code in the save mutation.
	const [saveError] = await ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
		...args,
		confirmBooking: true,
		googleCalendarId: client.calendarId,
		googleEventId,
		...(reservation ? { reservation } : {})
	});

	if (saveError !== null) {
		return err(saveError);
	}

	return ok({ ok: true, googleOutcome: "createdFromFailed" });
}

export async function updateSessionTimingWithGoogleCalendar({
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
}): Promise<
	Result<SessionCalendarTimingUpdateResult & { sessionStartAt: number }, AdminSessionUpdateError>
> {
	const [sessionStartError, sessionStartAt] = getSessionStartAt(date, time, client.timeZone);

	if (sessionStartError !== null) {
		return err(sessionStartError);
	}

	const [timingError] = await validateSessionTimingEdit({
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
	});

	if (timingError !== null) {
		return err(timingError);
	}

	const [calendarError, calendarUpdate] = await updateSessionCalendarEventTiming({
		session,
		client,
		date,
		details,
		createMissingEvent,
		time
	});

	if (calendarError !== null) {
		return err(calendarError);
	}

	return ok({ ...calendarUpdate, sessionStartAt });
}

async function updateConfirmedSessionGoogleEventOrCreateReplacement({
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
}): Promise<Result<AdminSessionUpdateResult | null, AdminSessionUpdateError>> {
	const [timingUpdateError, timingUpdate] = await updateSessionTimingWithGoogleCalendar({
		bypassAvailabilitySettings: true,
		session,
		client,
		date: args.date,
		details: getAdminSessionEventDetails(args),
		duration: args.duration,
		settings,
		time: args.time
	});

	if (timingUpdateError !== null) {
		return err(timingUpdateError);
	}

	if (!timingUpdate.googleEventId && !timingUpdate.googleCalendarId) {
		return ok(null);
	}

	const [saveError] = await ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
		...args,
		googleCalendarId: timingUpdate.googleCalendarId,
		googleEventId: timingUpdate.googleEventId,
		...(reservation ? { reservation } : {})
	});

	if (saveError !== null) {
		return err(saveError);
	}

	return ok({ ok: true, googleOutcome: timingUpdate.outcome });
}

export async function updateSessionFromAdminWithGoogleCalendar({
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
}): Promise<Result<AdminSessionUpdateResult, AdminSessionUpdateError>> {
	// Updates that do not move the session do not need a slot reservation.
	if (!didSessionTimingChange(session, args)) {
		return applyAdminSessionUpdate({ args, session, client, ctx, settings });
	}

	// Convert the requested date and time into one timestamp.
	const [startError, sessionStartAt] = getSessionStartAt(args.date, args.time, client.timeZone);
	if (startError !== null) return err(startError);

	// Reserve the new time before updating the session or Google Calendar.
	const [reservationError, reservationResult] = await ctx.runMutation(
		internal.sessionScheduling.reserveSessionReservation,
		{
			bookingId: session._id,
			duration: args.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt
		}
	);
	if (reservationError !== null || reservationResult.outcome === "unavailable") {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}

	// Pass the reservation through so the save can prove it owns the time.
	const reservation = reservationResult.reservation;
	const [updateError, updateResult] = await applyAdminSessionUpdate({
		args,
		session,
		client,
		ctx,
		reservation,
		settings
	});
	// Release the reservation if any part of the update fails.
	if (updateError !== null) {
		await ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: session._id,
			reservation
		});
		return err(updateError);
	}

	// The successful save clears the reservation as part of the same mutation.
	return ok(updateResult);
}

async function applyAdminSessionUpdate({
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
}): Promise<Result<AdminSessionUpdateResult, AdminSessionUpdateError>> {
	// Failed checkouts have no Calendar event, so an admin edit creates one and confirms the session.
	if (session.status === "failed") {
		return promoteFailedSessionFromAdmin({ args, session, client, ctx, reservation, settings });
	}

	// Pending, expired, and abandoned bookings save in Convex only; no Google event sync.
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		const [timingError] = await validateSessionTimingEdit({
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
		});

		if (timingError !== null) {
			return err(timingError);
		}

		const [saveError] = await ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
			...args,
			...(reservation ? { reservation } : {})
		});

		if (saveError !== null) {
			return err(saveError);
		}

		return ok({ ok: true });
	}

	// Update the linked Google event. If it is missing/cancelled, this creates and saves a replacement.
	const [replacementError, replacementOutcome] =
		await updateConfirmedSessionGoogleEventOrCreateReplacement({
			args,
			session,
			client,
			ctx,
			reservation,
			settings
		});
	if (replacementError !== null) {
		return err(replacementError);
	}

	if (replacementOutcome) {
		return ok(replacementOutcome);
	}

	const [saveError] = await ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
		...args,
		...(reservation ? { reservation } : {})
	});

	if (saveError !== null) {
		return err(saveError);
	}

	return ok({ ok: true });
}
