import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForDate,
	type BusyPeriod,
} from "#studio/lib/bookingdatetime";
import { getBookingErrorMessage } from "#studio/features/booking-form/lib/booking-errors";
import type { BookingFormValues } from "#studio/features/booking-form/lib/form-shared";

export interface BusyDayWindow {
	busyPeriods: BusyPeriod[];
	date: string;
	label: string;
}

export interface MonthlyBusyWindowsResult {
	busyWindows: BusyDayWindow[];
	month: string;
}

export function getBookableMonthKeys(startDate: Date, endDate: Date) {
	const monthKeys: string[] = [];
	const month = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
	const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

	while (month <= endMonth) {
		monthKeys.push(formatMonthKey(month));
		month.setMonth(month.getMonth() + 1);
	}

	return monthKeys;
}

export function getUncachedMonthKeys(
	bookableMonthKeys: string[],
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>,
) {
	return bookableMonthKeys.filter((month) => !monthlyBusyWindowsByMonth[month]);
}

export function mergeMonthlyBusyWindows(
	current: Record<string, BusyDayWindow[]>,
	results: MonthlyBusyWindowsResult[],
) {
	return {
		...current,
		...Object.fromEntries(results.map((result) => [result.month, result.busyWindows] as const)),
	};
}

export function isAvailabilityRateLimitedMessage(availabilityError: string) {
	return (
		availabilityError === getBookingErrorMessage({ data: { code: "GOOGLE_CALENDAR_RATE_LIMITED" } })
	);
}

export function getSelectedBusyDay({
	date,
	monthlyBusyWindowsByMonth,
	selectedMonth,
}: {
	date: string;
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
	selectedMonth: string;
}) {
	return monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === date) ?? null;
}

export function isBookingDateDisabled({
	currentTimestamp,
	date,
	duration,
	isAvailabilityRateLimited,
	lastBookableDate,
	monthlyBusyWindowsByMonth,
	today,
}: {
	currentTimestamp: number;
	date: Date;
	duration: BookingFormValues["duration"];
	isAvailabilityRateLimited: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
	today: Date;
}) {
	if (date < today || date > lastBookableDate) {
		return true;
	}

	const monthKey = formatMonthKey(date);
	const busyDays = monthlyBusyWindowsByMonth[monthKey];
	const dateValue = formatDateValue(date);
	const busyDay = busyDays?.find((day) => day.date === dateValue);
	const availableTimesForDate = getAvailableTimesForDate({
		busyPeriods: busyDay?.busyPeriods ?? [],
		currentTimestamp,
		dateValue,
		duration,
	});

	if (!busyDays && isAvailabilityRateLimited) {
		return true;
	}

	return availableTimesForDate.length === 0;
}
