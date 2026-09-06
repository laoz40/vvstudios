import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import {
	getDevRescheduleAvailabilityStatus,
	type DevRescheduleScenario
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { useRescheduleBusyWindows } from "#studio/features/booking-form/hooks/useRescheduleBusyWindows";
import {
	getBookingTimeSelectionMessage,
	type BookingTimeSelectionMessage
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getNextAvailableBookingDate,
	getSelectedBusyDay,
	isBookingDateDisabled,
	isBookingDateUnavailable,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import type { RescheduleLinkInvalidContent } from "#studio/features/booking-form/lib/reschedule-errors";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatDateValue,
	formatMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday,
	type BusyPeriod
} from "#studio/lib/bookingdatetime";

interface UseRescheduleAvailabilityOptions {
	activeDevScenario: DevRescheduleScenario | undefined;
	duration: string;
	token: string;
}

interface RescheduleAvailabilityState {
	availability: BookingAvailabilityPickerState;
	hasCompleteSelection: boolean;
	invalidLinkMessage: RescheduleLinkInvalidContent | null;
	selectedDateValue: string;
	selectedTime: string;
	setSelectedDateValue: (date: string) => void;
	setSelectedTime: (time: string) => void;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
}

interface ReschedulePickerOptions {
	availableTimes: string[];
	disabledDates: (date: Date) => boolean;
	nextAvailableDate: Date | undefined;
	selectedBusyPeriods: BusyPeriod[];
	unavailableDates: (date: Date) => boolean;
}

function getReschedulePickerOptions({
	activeDevScenario,
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
}: {
	activeDevScenario: DevRescheduleScenario | undefined;
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
}): ReschedulePickerOptions {
	const selectedBusyDay = selectedDateValue
		? getSelectedBusyDay({ date: selectedDateValue, monthlyBusyWindowsByMonth, selectedMonth })
		: null;
	const devAvailabilityStatus = getDevRescheduleAvailabilityStatus(activeDevScenario);
	let availableTimes: string[];

	if (activeDevScenario) {
		availableTimes = devAvailabilityStatus.kind === "ready" ? [...devAvailabilityStatus.times] : [];
	} else {
		availableTimes = getBookableAvailableTimes({
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
	}

	return {
		availableTimes,
		disabledDates: (date: Date) =>
			isBookingDateDisabled({
				date,
				isAvailabilityRateLimited: false,
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
			settings
		}),
		selectedBusyPeriods: selectedBusyDay?.busyPeriods ?? [],
		unavailableDates: (date: Date) =>
			isBookingDateUnavailable({
				currentTimestamp,
				date,
				duration,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				settings,
				today
			})
	};
}

export function useRescheduleAvailability({
	activeDevScenario,
	duration,
	token
}: UseRescheduleAvailabilityOptions): RescheduleAvailabilityState {
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	// Availability settings
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Date and time selection
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");

	// Derived date range values
	const selectedDate = parseDateValue(selectedDateValue);
	const today = useMemo(() => startOfToday(), []);
	const lastBookableDate = getLastBookableDate(today, availabilitySettings.maxDaysAhead);
	const bookableStartDateValue = formatDateValue(today);
	const bookableEndDateValue = formatDateValue(lastBookableDate);
	const bookableMonthKeys = useMemo(() => {
		const startDate = parseDateValue(bookableStartDateValue);
		const endDate = parseDateValue(bookableEndDateValue);
		return startDate && endDate ? getBookableMonthKeys(startDate, endDate) : [];
	}, [bookableStartDateValue, bookableEndDateValue]);
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = selectedDateValue ? selectedDateValue.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !selectedDateValue || selectedMonth === visibleMonth;

	const {
		availabilityError,
		clearInvalidLinkMessage,
		invalidLinkMessage,
		isLoadingMonthAvailability,
		monthlyBusyWindowsByMonth
	} = useRescheduleBusyWindows({ activeDevScenario, bookableMonthKeys, token });

	// Keep time-based availability fresh for stale date checks.
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// Reset the selected slot when switching dev scenarios.
	useEffect(() => {
		if (!activeDevScenario) {
			return;
		}

		clearInvalidLinkMessage();
		setSelectedTime("");
		setSelectedDateValue(formatDateValue(startOfToday()));
	}, [activeDevScenario, clearInvalidLinkMessage]);

	const pickerOptions = getReschedulePickerOptions({
		activeDevScenario,
		currentTimestamp,
		duration,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
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

	return {
		availability: {
			availabilityError,
			availableTimes: pickerOptions.availableTimes,
			calendarMonth,
			disabledDates: pickerOptions.disabledDates,
			isLoadingMonthAvailability,
			nextAvailableDate: pickerOptions.nextAvailableDate,
			selectedBusyPeriods: pickerOptions.selectedBusyPeriods,
			unavailableDates: pickerOptions.unavailableDates,
			isSelectedDateInPast: false,
			isViewingSelectedMonth,
			selectedDate,
			setCalendarMonth
		},
		hasCompleteSelection: Boolean(selectedDateValue && selectedTime),
		invalidLinkMessage,
		selectedDateValue,
		selectedTime,
		setSelectedDateValue,
		setSelectedTime,
		timeSelectionMessage
	};
}
