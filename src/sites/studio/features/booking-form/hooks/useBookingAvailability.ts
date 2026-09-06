import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import { useBookingBusyWindows } from "#studio/features/booking-form/hooks/useBookingBusyWindows";
import { availabilityErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import {
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getNextAvailableBookingDate,
	getSelectedBusyDay,
	isBookingDateDisabled,
	isBookingDateUnavailable,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { BusyPeriod } from "#studio/lib/bookingdatetime";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatDateValue,
	formatMonthKey,
	getCurrentMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";

export interface BookingAvailabilityPickerState {
	availabilityError: string;
	availableTimes: string[];
	calendarMonth: Date;
	disabledDates: (date: Date) => boolean;
	isLoadingMonthAvailability: boolean;
	nextAvailableDate: Date | undefined;
	selectedBusyPeriods: BusyPeriod[];
	unavailableDates: (date: Date) => boolean;
	isSelectedDateInPast: boolean;
	isViewingSelectedMonth: boolean;
	selectedDate: Date | undefined;
	setCalendarMonth: (date: Date) => void;
}

export interface BookingAvailabilityState extends BookingAvailabilityPickerState {
	setAvailabilityError: (message: string) => void;
}

interface UseBookingAvailabilityOptions {
	date: string;
	duration: string;
	onSelectedTimeInvalidated: () => void;
	selectedTime: string;
}

interface BookingPickerOptions {
	availableTimes: string[];
	disabledDates: (date: Date) => boolean;
	nextAvailableDate: Date | undefined;
	selectedBusyPeriods: BusyPeriod[];
	unavailableDates: (date: Date) => boolean;
}

function getBookingPickerOptions({
	availabilitySettings,
	currentTimestamp,
	date,
	duration,
	isAvailabilityRateLimited,
	isViewingSelectedMonth,
	lastBookableDate,
	monthlyBusyWindowsByMonth,
	selectedDate,
	selectedMonth,
	today
}: {
	availabilitySettings: BookingAvailabilitySettings;
	currentTimestamp: number;
	date: string;
	duration: string;
	isAvailabilityRateLimited: boolean;
	isViewingSelectedMonth: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
	selectedDate: Date | undefined;
	selectedMonth: string;
	today: Date;
}): BookingPickerOptions {
	const selectedBusyDay = date
		? getSelectedBusyDay({ date, monthlyBusyWindowsByMonth, selectedMonth })
		: null;

	return {
		availableTimes: getBookableAvailableTimes({
			currentTimestamp,
			duration,
			isViewingSelectedMonth,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			selectedBusyDay,
			selectedDate,
			selectedDateValue: date,
			selectedMonth,
			settings: availabilitySettings,
			today
		}),
		disabledDates: (disabledDate: Date) =>
			isBookingDateDisabled({
				date: disabledDate,
				isAvailabilityRateLimited,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				today
			}),
		nextAvailableDate: getNextAvailableBookingDate({
			currentTimestamp,
			duration,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			selectedDate,
			settings: availabilitySettings
		}),
		selectedBusyPeriods: selectedBusyDay?.busyPeriods ?? [],
		unavailableDates: (calendarDate: Date) =>
			isBookingDateUnavailable({
				currentTimestamp,
				date: calendarDate,
				duration,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				settings: availabilitySettings,
				today
			})
	};
}

export function useBookingAvailability({
	date,
	duration,
	onSelectedTimeInvalidated,
	selectedTime
}: UseBookingAvailabilityOptions): BookingAvailabilityState {
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	// Availability settings and date bounds
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const today = startOfToday();
	const lastBookableDate = getLastBookableDate(today, availabilitySettings.maxDaysAhead);
	const selectedDate = parseDateValue(date);
	const isSelectedDateInPast = selectedDate ? selectedDate < today : false;
	const isSelectedDateTooFarInFuture = selectedDate ? selectedDate > lastBookableDate : false;
	const bookableStartDateValue = formatDateValue(today);
	const bookableEndDateValue = formatDateValue(lastBookableDate);

	// Availability state
	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [manualAvailabilityError, setAvailabilityError] = useState("");
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Bookable month range
	const bookableMonthKeys = useMemo(() => {
		const startDate = parseDateValue(bookableStartDateValue);
		const endDate = parseDateValue(bookableEndDateValue);

		return startDate && endDate ? getBookableMonthKeys(startDate, endDate) : [];
	}, [bookableStartDateValue, bookableEndDateValue]);

	const { fetchAvailabilityError, isLoadingMonthAvailability, monthlyBusyWindowsByMonth } =
		useBookingBusyWindows({ bookableMonthKeys });
	const availabilityError = manualAvailabilityError || fetchAvailabilityError;

	// Visible month state
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = date ? date.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !date || selectedMonth === visibleMonth;
	const isAvailabilityRateLimited =
		availabilityError === availabilityErrorMessages.GOOGLE_CALENDAR_RATE_LIMITED;

	const pickerOptions = getBookingPickerOptions({
		availabilitySettings,
		currentTimestamp,
		date,
		duration,
		isAvailabilityRateLimited,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		selectedDate,
		selectedMonth,
		today
	});

	// Keep time-based availability fresh
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// Clear selected time when it is no longer valid
	useEffect(() => {
		if (!date || isSelectedDateInPast || isSelectedDateTooFarInFuture) {
			if (selectedTime) {
				onSelectedTimeInvalidated();
			}
			return;
		}

		if (!isViewingSelectedMonth) {
			return;
		}

		if (isLoadingMonthAvailability && !monthlyBusyWindowsByMonth[selectedMonth]) {
			return;
		}

		if (pickerOptions.availableTimes.length === 0) {
			if (selectedTime) {
				onSelectedTimeInvalidated();
			}
			return;
		}

		if (selectedTime && !pickerOptions.availableTimes.includes(selectedTime)) {
			onSelectedTimeInvalidated();
		}
	}, [
		pickerOptions.availableTimes,
		date,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		onSelectedTimeInvalidated,
		selectedMonth,
		selectedTime
	]);

	return {
		availabilityError,
		availableTimes: pickerOptions.availableTimes,
		calendarMonth,
		disabledDates: pickerOptions.disabledDates,
		isLoadingMonthAvailability,
		nextAvailableDate: pickerOptions.nextAvailableDate,
		selectedBusyPeriods: pickerOptions.selectedBusyPeriods,
		unavailableDates: pickerOptions.unavailableDates,
		isSelectedDateInPast,
		isViewingSelectedMonth,
		selectedDate,
		setAvailabilityError,
		setCalendarMonth
	};
}
