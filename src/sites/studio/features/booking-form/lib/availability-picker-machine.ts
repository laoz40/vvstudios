import { exhaustiveCheck } from "#/lib/result";
import type { RescheduleLinkInvalidContent } from "#studio/features/booking-form/lib/reschedule-errors";
import {
	getBookableAvailableTimes,
	getNextAvailableBookingDate,
	getSelectedBusyDay,
	isBookingDateDisabled,
	isBookingDateUnavailable,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import {
	formatMonthKey,
	getLastBookableDate,
	parseDateValue,
	startOfMonth,
	type BookingAvailabilitySettings
} from "#studio/lib/bookingdatetime";

export type AvailabilityState =
	| { kind: "loading" }
	| { kind: "ready"; windows: BusyWindowsByMonth }
	| {
			kind: "error";
			error: { reason: "rateLimited" | "unavailable"; message: string };
			cachedWindows: BusyWindowsByMonth;
	  }
	// Development scenarios supply fixed slots instead of calendar windows.
	| { kind: "preview"; times: readonly string[] }
	| { kind: "invalidLink"; content: RescheduleLinkInvalidContent };

export interface CalendarSelection {
	date: string;
	time: string;
	duration: string;
}

type SelectionValidity =
	| { kind: "empty" }
	| { kind: "pending" }
	| { kind: "valid" }
	| { kind: "invalid"; reason: "date" | "unavailable" };

interface AvailabilityCalendarState {
	currentTimestamp: number;
	month: Date;
	errorOverride: string;
}

type AvailabilityCalendarEvent =
	| { type: "clockAdvanced"; timestamp: number }
	| { type: "monthChanged"; month: Date }
	| { type: "errorOverrideChanged"; message: string };

export function createAvailabilityCalendar(timestamp: number): AvailabilityCalendarState {
	return {
		currentTimestamp: timestamp,
		month: startOfMonth(new Date(timestamp)),
		errorOverride: ""
	};
}

export function reduceAvailabilityCalendar(
	state: AvailabilityCalendarState,
	event: AvailabilityCalendarEvent
): AvailabilityCalendarState {
	switch (event.type) {
		case "clockAdvanced":
			return { ...state, currentTimestamp: event.timestamp };
		case "monthChanged":
			return { ...state, month: event.month };
		case "errorOverrideChanged":
			return { ...state, errorOverride: event.message };
		default:
			return exhaustiveCheck(event);
	}
}

export function getBookableDateRange({
	currentTimestamp,
	settings
}: {
	currentTimestamp: number;
	settings: BookingAvailabilitySettings;
}) {
	const now = new Date(currentTimestamp);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const lastBookableDate = getLastBookableDate(today, settings.maxDaysAhead);

	return { currentTimestamp, lastBookableDate, settings, today };
}

export function getAvailabilityWindows(availability: AvailabilityState): BusyWindowsByMonth {
	switch (availability.kind) {
		case "ready":
			return availability.windows;
		case "error":
			return availability.cachedWindows;
		case "loading":
		case "preview":
		case "invalidLink":
			return {};
		default:
			return exhaustiveCheck(availability);
	}
}

function getSelectionValidity({
	availableTimes,
	isDateValid,
	selectedTime
}: {
	availableTimes: string[] | undefined;
	isDateValid: boolean;
	selectedTime: string;
}): SelectionValidity {
	if (!selectedTime) {
		return { kind: "empty" };
	}

	if (!isDateValid) {
		return { kind: "invalid", reason: "date" };
	}

	// A fetch in progress or a failed fetch without cached data cannot disprove a selection.
	if (availableTimes === undefined) {
		return { kind: "pending" };
	}

	return availableTimes.includes(selectedTime)
		? { kind: "valid" }
		: { kind: "invalid", reason: "unavailable" };
}

interface AvailabilityPickerInput {
	availability: AvailabilityState;
	calendar: { month: Date; dateRange: ReturnType<typeof getBookableDateRange> };
	selection: CalendarSelection;
}

function getSelectedSlot({ availability, calendar, selection }: AvailabilityPickerInput) {
	const { currentTimestamp, lastBookableDate, settings, today } = calendar.dateRange;
	const monthlyBusyWindowsByMonth = getAvailabilityWindows(availability);
	const selectedDate = parseDateValue(selection.date);
	const selectedMonth = selection.date.slice(0, 7);

	const isViewingSelectedMonth =
		!selection.date || selectedMonth === formatMonthKey(calendar.month);

	const isSelectedDateInPast = selectedDate ? selectedDate < today : false;

	const isDateValid = Boolean(
		selection.duration && selectedDate && !isSelectedDateInPast && selectedDate <= lastBookableDate
	);

	const selectedBusyDay = getSelectedBusyDay({
		date: selection.date,
		monthlyBusyWindowsByMonth,
		selectedMonth
	});

	const hasSelectedMonthAvailability =
		availability.kind === "preview" || monthlyBusyWindowsByMonth[selectedMonth] !== undefined;

	// Browsing another month must not change whether the selected slot is valid.
	let selectedDateTimes = getBookableAvailableTimes({
		currentTimestamp,
		duration: selection.duration,
		isViewingSelectedMonth: true,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedDate,
		selectedDateValue: selection.date,
		selectedMonth,
		settings,
		today
	});

	if (availability.kind === "preview") {
		selectedDateTimes = isDateValid ? [...availability.times] : [];
	}

	const validity = getSelectionValidity({
		availableTimes: hasSelectedMonthAvailability ? selectedDateTimes : undefined,
		isDateValid,
		selectedTime: selection.time
	});

	return {
		availableTimes: isViewingSelectedMonth ? selectedDateTimes : [],
		isSelectedDateInPast,
		isViewingSelectedMonth,
		selectedBusyPeriods: selectedBusyDay?.busyPeriods ?? [],
		selectedDate,
		validity
	};
}

export function getAvailabilityPicker(input: AvailabilityPickerInput) {
	const { availability, calendar, selection } = input;
	const slot = getSelectedSlot(input);
	const { currentTimestamp, lastBookableDate, settings, today } = calendar.dateRange;
	const monthlyBusyWindowsByMonth = getAvailabilityWindows(availability);
	const error = availability.kind === "error" ? availability.error : null;

	return {
		...slot,
		availabilityError: error?.message ?? "",
		disabledDates: (date: Date) =>
			isBookingDateDisabled({
				date,
				isAvailabilityRateLimited: error?.reason === "rateLimited",
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				today
			}),
		isLoadingMonthAvailability: availability.kind === "loading",
		nextAvailableDate: getNextAvailableBookingDate({
			currentTimestamp,
			duration: selection.duration,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			selectedDate: slot.selectedDate,
			settings
		}),
		unavailableDates: (date: Date) =>
			isBookingDateUnavailable({
				currentTimestamp,
				date,
				duration: selection.duration,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				settings,
				today
			})
	};
}
