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

export interface BookableRangeBusyWindowsResult {
	busyWindowsByMonth: Record<string, BusyDayWindow[]>;
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
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>
) {
	return bookableMonthKeys.filter((month) => !monthlyBusyWindowsByMonth[month]);
}

export function mergeBookableRangeBusyWindows({
	bookableMonthKeys,
	current,
	result
}: {
	bookableMonthKeys: string[];
	current: Record<string, BusyDayWindow[]>;
	result: BookableRangeBusyWindowsResult;
}) {
	return {
		...current,
		...Object.fromEntries(
			bookableMonthKeys.map((month) => [month, result.busyWindowsByMonth[month] ?? []] as const)
		)
	};
}

export function getSelectedBusyDay({
	date,
	monthlyBusyWindowsByMonth,
	selectedMonth
}: {
	date: string;
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
	selectedMonth: string;
}) {
	return monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === date) ?? null;
}

export function getBookableAvailableTimes({
	currentTimestamp,
	duration,
	isLoadingMonthAvailability,
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
	isLoadingMonthAvailability: boolean;
	isViewingSelectedMonth: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
	selectedBusyDay: BusyDayWindow | null;
	selectedDate: Date | undefined;
	selectedDateValue: string;
	selectedMonth: string;
	settings: BookingAvailabilitySettings;
	today: Date;
}) {
	if (
		!selectedDateValue ||
		!selectedDate ||
		selectedDate < today ||
		selectedDate > lastBookableDate
	) {
		return [];
	}

	if (!isViewingSelectedMonth) {
		return [];
	}

	if (isLoadingMonthAvailability && !monthlyBusyWindowsByMonth[selectedMonth]) {
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
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
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
