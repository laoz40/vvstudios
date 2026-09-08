import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, ok, okAsync, type Result } from "neverthrow";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { fromConvexTuple } from "#convex/lib/result";
import type { SessionReservation } from "#convex/lib/sessionReservations";
import {
	checkSessionMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
	isTimeSlotAvailable,
	type SessionAvailabilitySettings,
	type SessionTimeParseError
} from "#convex/lib/sessionCalendarTime";
import { getBusyWindows } from "#convex/lib/googleCalendarAvailability";
import { calendarResultAsync } from "#convex/lib/googleCalendarErrors";

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
	addons: BookingAddon[];
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
		...pickBookingAddonQuantities(values)
	}).totalDueAmount;
}

export function isValidSessionRemainingBalanceAmount(amount?: number) {
	return amount === undefined || (Number.isFinite(amount) && amount >= 0);
}

export type AdminSessionTimingPatch = {
	name: string;
	phone: string;
	accountName: string;
	abn: string | undefined;
	email: string;
	date: string;
	time: string;
	duration: string;
	remainingBalanceAmount: number;
	sessionStartAt: number;
	service: string;
	addons: Doc<"bookings">["addons"];
	essentialEditQuantity: string | undefined;
	completeEditQuantity: string | undefined;
	clipsPackageQuantity: string | undefined;
	handcraftedClipsQuantity: string | undefined;
	notes: string | undefined;
	reminderEmailClaimedAt?: undefined;
	reminderEmailSentAt?: undefined;
	reminderEmailFailureCode?: undefined;
};

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

	return getSessionStartAt(values.date, values.time, timeZone).map((sessionStartAt) => {
		const patch: AdminSessionTimingPatch = {
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
			notes: values.notes
		};

		if (scheduleChanged) {
			patch.reminderEmailClaimedAt = undefined;
			patch.reminderEmailSentAt = undefined;
			patch.reminderEmailFailureCode = undefined;
		}

		return patch;
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

type FailBookingConfirmationMutationArgs = {
	bookingId: Id<"bookings">;
	failureCode: string;
	reservation?: SessionReservation;
};

export function failBookingConfirmation(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	failureCode: string,
	reservation?: SessionReservation
) {
	const mutationArgs: FailBookingConfirmationMutationArgs = { bookingId, failureCode };

	if (reservation) {
		mutationArgs.reservation = reservation;
	}

	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.markBookingConfirmationFailed, mutationArgs)
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
	| { reason: "BOOKING_INVALID_DURATION" }
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
		calendarResultAsync(
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
			"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		).andThen((isAvailable) =>
			isAvailable ? ok(null) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		)
	);
}

export function didSessionTimingChange(existing: SessionTimingValues, next: SessionTimingValues) {
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
