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
	formatDateValue,
	formatMonthKey,
	parseDateValue,
	startOfToday
} from "#studio/lib/bookingdatetime";

export interface PackageDatePickerOptions {
	availableTimes: string[];
	disabledDates: (date: Date) => boolean;
	nextAvailableDate: Date | undefined;
	selectedBusyPeriods: BusyPeriod[];
	unavailableDates: (date: Date) => boolean;
}

interface PackageDatePickerParams {
	currentTimestamp: number;
	duration: string;
	isViewingSelectedMonth: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
	selectedDate: Date | undefined;
	selectedDateValue: string;
	selectedMonth: string;
	settings: BookingAvailabilitySettings;
	today: Date;
}

export function getPackageScheduleCalendarView({
	calendarMonth,
	expiresAt,
	selectedDateValue
}: {
	calendarMonth: Date;
	expiresAt: number;
	selectedDateValue: string;
}) {
	const today = startOfToday();
	const selectedDate = parseDateValue(selectedDateValue);
	const expiresDateValue = formatDateValue(new Date(expiresAt));
	const lastBookableDate = parseDateValue(expiresDateValue) ?? today;
	const bookableMonthKeys = getBookableMonthKeys(today, lastBookableDate);
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = selectedDateValue ? selectedDateValue.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !selectedDateValue || selectedMonth === visibleMonth;

	return {
		bookableMonthKeys,
		isViewingSelectedMonth,
		lastBookableDate,
		selectedDate,
		selectedMonth,
		today
	};
}

export function getPackageDatePickerOptions({
	currentTimestamp,
	duration,
	isViewingSelectedMonth,
	lastBookableDate,
	monthlyBusyWindowsByMonth,
	selectedDate,
	selectedDateValue,
	selectedMonth,
	settings,
	today
}: PackageDatePickerParams): PackageDatePickerOptions {
	const selectedBusyDay = selectedDateValue
		? getSelectedBusyDay({ date: selectedDateValue, monthlyBusyWindowsByMonth, selectedMonth })
		: null;
	const availableTimes = getBookableAvailableTimes({
		currentTimestamp,
		duration,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedDate,
		selectedDateValue,
		selectedMonth,
		settings,
		today
	});
	const nextAvailableDate = getNextAvailableBookingDate({
		currentTimestamp,
		duration,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		selectedDate,
		settings
	});
	const selectedBusyPeriods = selectedBusyDay?.busyPeriods ?? [];

	function disabledDates(date: Date) {
		return isBookingDateDisabled({
			date,
			isAvailabilityRateLimited: false,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			today
		});
	}

	function unavailableDates(date: Date) {
		return isBookingDateUnavailable({
			currentTimestamp,
			date,
			duration,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			settings,
			today
		});
	}

	return {
		availableTimes,
		disabledDates,
		nextAvailableDate,
		selectedBusyPeriods,
		unavailableDates
	};
}
