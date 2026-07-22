import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForDate,
	type BookingAvailabilitySettings,
	type BusyPeriod
} from "#studio/lib/bookingdatetime";

export interface BusyDayWindow {
	busyPeriods: BusyPeriod[];
	date: string;
	label: string;
}

export type BusyWindowsByMonth = Partial<Record<string, BusyDayWindow[]>>;

export interface BookableRangeBusyWindowsResult {
	busyWindowsByMonth: Record<string, BusyDayWindow[]>;
}

export function getBookableMonthKeys(startDate: Date, endDate: Date) {
	const monthKeys: string[] = [];
	const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
	const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

	for (
		let month = firstMonth;
		month <= endMonth;
		month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
	) {
		monthKeys.push(formatMonthKey(month));
	}

	return monthKeys;
}

export function getUncachedMonthKeys(
	bookableMonthKeys: string[],
	monthlyBusyWindowsByMonth: BusyWindowsByMonth
) {
	return bookableMonthKeys.filter((month) => !monthlyBusyWindowsByMonth[month]);
}

export function mergeBookableRangeBusyWindows({
	bookableMonthKeys,
	current,
	result
}: {
	bookableMonthKeys: string[];
	current: BusyWindowsByMonth;
	result: BookableRangeBusyWindowsResult;
}) {
	const merged: Record<string, BusyDayWindow[]> = {};

	for (const [month, busyWindows] of Object.entries(current)) {
		if (busyWindows) {
			merged[month] = busyWindows;
		}
	}

	for (const month of bookableMonthKeys) {
		merged[month] = result.busyWindowsByMonth[month] ?? [];
	}

	return merged;
}

export function getSelectedBusyDay({
	date,
	monthlyBusyWindowsByMonth,
	selectedMonth
}: {
	date: string;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
	selectedMonth: string;
}) {
	return monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === date) ?? null;
}

export function excludeBusyEvent(monthlyBusyWindowsByMonth: BusyWindowsByMonth, eventId?: string) {
	if (!eventId) {
		return monthlyBusyWindowsByMonth;
	}

	const filteredMonths: Array<[string, BusyDayWindow[]]> = [];

	for (const [month, days] of Object.entries(monthlyBusyWindowsByMonth)) {
		if (!days) {
			continue;
		}

		filteredMonths.push([
			month,
			days.map((day) => ({
				...day,
				busyPeriods: day.busyPeriods.filter((period) => period.eventId !== eventId)
			}))
		]);
	}

	return Object.fromEntries(filteredMonths);
}

export function getBookableAvailableTimes({
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
}: {
	currentTimestamp: number;
	duration: string;
	isViewingSelectedMonth: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
	selectedBusyDay: BusyDayWindow | null;
	selectedDate: Date | undefined;
	selectedDateValue: string;
	selectedMonth: string;
	settings: BookingAvailabilitySettings;
	today: Date;
}) {
	if (
		!selectedDateValue ||
		!duration ||
		!selectedDate ||
		selectedDate < today ||
		selectedDate > lastBookableDate
	) {
		return [];
	}

	if (!isViewingSelectedMonth) {
		return [];
	}

	if (!monthlyBusyWindowsByMonth[selectedMonth]) {
		return [];
	}

	return getAvailableTimesForDate({
		busyPeriods: selectedBusyDay?.busyPeriods ?? [],
		currentTimestamp,
		dateValue: selectedDateValue,
		duration,
		settings
	});
}

export function isBookingDateDisabled({
	currentTimestamp,
	date,
	duration,
	isAvailabilityRateLimited,
	lastBookableDate,
	monthlyBusyWindowsByMonth,
	settings,
	today
}: {
	currentTimestamp: number;
	date: Date;
	duration: string;
	isAvailabilityRateLimited: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
	settings: BookingAvailabilitySettings;
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
		settings
	});

	if (!busyDays && isAvailabilityRateLimited) {
		return true;
	}

	return availableTimesForDate.length === 0;
}
