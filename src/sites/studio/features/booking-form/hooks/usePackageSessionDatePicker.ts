import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { usePackageCalendarBusyWindows } from "#studio/features/booking-form/hooks/usePackageCalendarBusyWindows";
import {
	getBookingTimeSelectionMessage,
	type BookingTimeSelectionMessage
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	excludeBusyEvent,
	getBookableMonthKeys
} from "#studio/features/booking-form/lib/monthly-availability";
import { getPackageDatePickerOptions } from "#studio/features/booking-form/lib/package-scheduling-calendar";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatDateValue,
	formatMonthKey,
	getCurrentTimestamp,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

interface UsePackageSessionDatePickerOptions {
	excludeGoogleEventId?: string;
	packageData: PackageData;
	selectedDateValue: string;
	token: string;
}

interface PackageSessionDatePickerState {
	availability: BookingAvailabilityPickerState;
	availabilitySettings: BookingAvailabilitySettings;
	currentTimestamp: number;
	invalidateCalendarCache: () => void;
	noticeWindowLabel: string;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
}

export function usePackageSessionDatePicker({
	excludeGoogleEventId,
	packageData,
	selectedDateValue,
	token
}: UsePackageSessionDatePickerOptions): PackageSessionDatePickerState {
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	const today = useMemo(() => startOfToday(), []);
	const selectedDate = parseDateValue(selectedDateValue);
	const expiresDateValue = formatDateValue(new Date(packageData.expiresAt));
	const lastBookableDate = useMemo(
		() => parseDateValue(expiresDateValue) ?? today,
		[expiresDateValue, today]
	);
	const bookableMonthKeys = useMemo(
		() => getBookableMonthKeys(today, lastBookableDate),
		[today, lastBookableDate]
	);
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = selectedDateValue ? selectedDateValue.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !selectedDateValue || selectedMonth === visibleMonth;

	const { busyWindowsByMonth, calendarLoadError, invalidateCalendarCache, isLoadingCalendar } =
		usePackageCalendarBusyWindows({ bookableMonthKeys, token });
	const busyWindowsForPicker = useMemo(
		() => excludeBusyEvent(busyWindowsByMonth, excludeGoogleEventId),
		[busyWindowsByMonth, excludeGoogleEventId]
	);

	// Keep lock and lead-time checks fresh.
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	const datePickerOptions = getPackageDatePickerOptions({
		currentTimestamp,
		duration: packageData.duration,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth: busyWindowsForPicker,
		selectedDate,
		selectedDateValue,
		selectedMonth,
		settings: availabilitySettings,
		today
	});
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth
	});
	const noticeWindowLabel = formatNoticeWindowLabel(availabilitySettings.leadTimeMinutes);

	return {
		availability: {
			availabilityError: calendarLoadError,
			availableTimes: datePickerOptions.availableTimes,
			calendarMonth,
			disabledDates: datePickerOptions.disabledDates,
			isLoadingMonthAvailability: isLoadingCalendar,
			nextAvailableDate: datePickerOptions.nextAvailableDate,
			selectedBusyPeriods: datePickerOptions.selectedBusyPeriods,
			unavailableDates: datePickerOptions.unavailableDates,
			isSelectedDateInPast: false,
			isViewingSelectedMonth,
			selectedDate,
			setCalendarMonth
		},
		availabilitySettings,
		currentTimestamp,
		invalidateCalendarCache,
		noticeWindowLabel,
		timeSelectionMessage
	};
}
