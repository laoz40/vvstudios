import { ConvexError } from "convex/values";
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { calculateBookingInvoiceAmounts } from "../../src/sites/studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
	checkBookingMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
	isTimeSlotAvailable,
	type BookingAvailabilitySettings,
} from "./bookingCalendarTime";
import { getBusyWindows } from "./googleCalendarAvailability";

type BookingEditValues = Pick<
	Doc<"bookings">,
	"accountName" | "addons" | "date" | "duration" | "email" | "name" | "phone" | "service" | "time"
> & {
	abn?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	essentialEditQuantity?: string;
};

export function getBookingSessionStartAt(date: string, time: string, timeZone: string) {
	return getUtcDateForZonedDateTime(date, time, timeZone).getTime();
}

type BookingEditField = keyof BookingEditValues;

// Timing field changes need availability checks.
const bookingTimingFields: readonly BookingEditField[] = ["date", "time", "duration"];
// Google event field changes will later update the calendar event.
const bookingGoogleEventFields: readonly BookingEditField[] = [
	"name",
	"email",
	"service",
	"addons",
	"date",
	"time",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
	"notes",
];
// Pricing field changes may recalculate the remaining balance.
const bookingPricingFields: readonly BookingEditField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
];

type BookingFieldChangeSummary = {
	changedFields: BookingEditField[];
	timingFieldsChanged: boolean;
	googleEventFieldsChanged: boolean;
	pricingFieldsChanged: boolean;
};

// Compare one editable field from the saved booking with the admin's draft.
// Addons are arrays, so compare their contents instead of the array objects.
function didBookingEditFieldChange(
	booking: Doc<"bookings">,
	values: BookingEditValues,
	field: BookingEditField,
) {
	const currentValue = booking[field];
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
export function getBookingEditFieldChanges(
	booking: Doc<"bookings">,
	values: BookingEditValues,
): BookingFieldChangeSummary {
	const valueFields = Object.keys(values) as BookingEditField[];
	const changedFields = valueFields.filter((field) =>
		didBookingEditFieldChange(booking, values, field),
	);

	return {
		changedFields,
		timingFieldsChanged: bookingTimingFields.some((field) => changedFields.includes(field)),
		googleEventFieldsChanged: bookingGoogleEventFields.some((field) =>
			changedFields.includes(field),
		),
		pricingFieldsChanged: bookingPricingFields.some((field) => changedFields.includes(field)),
	};
}

export function calculateBookingRemainingBalanceAmount(
	values: Pick<
		BookingEditValues,
		"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
	>,
) {
	return calculateBookingInvoiceAmounts({
		duration: values.duration,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
	}).totalDueAmount;
}

export function buildAdminBookingUpdatePatch({
	booking,
	timeZone,
	values,
}: {
	booking: Doc<"bookings">;
	timeZone: string;
	values: BookingEditValues;
}) {
	const changes = getBookingEditFieldChanges(booking, values);
	const scheduleChanged = changes.timingFieldsChanged;

	return {
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.email,
		date: values.date,
		time: values.time,
		duration: values.duration,
		remainingBalanceAmount: calculateBookingRemainingBalanceAmount(values),
		sessionStartAt: getBookingSessionStartAt(values.date, values.time, timeZone),
		service: values.service,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
		notes: values.notes,
		...(scheduleChanged
			? {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined,
				}
			: {}),
	};
}

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface VerifyBookingCanBeScheduledArgs {
	booking: Doc<"bookings">;
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	settings: BookingAvailabilitySettings;
	timeZone: string;
}

type BookingTimingValues = Pick<Doc<"bookings">, "date" | "duration" | "time">;

interface ExistingBookingTiming extends BookingTimingValues {
	googleCalendarId?: string;
	googleEventId?: string;
}

interface ValidateBookingTimingEditArgs {
	bypassAvailabilitySettings?: boolean;
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	existing: ExistingBookingTiming;
	next: BookingTimingValues;
	settings: BookingAvailabilitySettings;
	timeZone: string;
}

export async function failBookingCompletion(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	failureCode: string,
) {
	await ctx.runMutation(internal.bookings.markBookingCompletionFailed, {
		bookingId,
		failureCode,
	});
}

export async function verifyBookingCanBeScheduled({
	booking,
	calendar,
	calendarIds,
	settings,
	timeZone,
}: VerifyBookingCanBeScheduledArgs) {
	try {
		checkBookingMeetsAvailabilitySettings({
			date: booking.date,
			duration: booking.duration,
			settings,
			time: booking.time,
			timeZone,
		});
	} catch {
		return false;
	}

	const busyWindows = await getBusyWindows({
		calendar,
		calendarIds,
		date: booking.date,
		timeZone,
	});

	return isTimeSlotAvailable({
		busyWindows,
		date: booking.date,
		duration: booking.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		time: booking.time,
		timeZone,
	});
}

type BookingAvailabilityErrorData = {
	code: "BOOKING_TIME_UNAVAILABLE";
};

export async function validateBookingTimingEdit({
	bypassAvailabilitySettings = false,
	calendar,
	calendarIds,
	existing,
	next,
	settings,
	timeZone,
}: ValidateBookingTimingEditArgs) {
	if (!didBookingTimingChange(existing, next)) {
		return;
	}

	if (!bypassAvailabilitySettings) {
		checkBookingMeetsAvailabilitySettings({
			date: next.date,
			duration: next.duration,
			settings,
			time: next.time,
			timeZone,
		});
	}
	const busyWindows = await getBusyWindows({
		calendar,
		calendarIds,
		date: next.date,
		ignoredEvent: {
			calendarId: existing.googleCalendarId,
			eventId: existing.googleEventId,
		},
		timeZone,
	});

	const isAvailable = isTimeSlotAvailable({
		busyWindows,
		date: next.date,
		duration: next.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		time: next.time,
		timeZone,
	});

	if (!isAvailable) {
		throw new ConvexError<BookingAvailabilityErrorData>({
			code: "BOOKING_TIME_UNAVAILABLE",
		});
	}
}

function didBookingTimingChange(existing: BookingTimingValues, next: BookingTimingValues) {
	return (
		existing.date !== next.date ||
		existing.time !== next.time ||
		existing.duration !== next.duration
	);
}
