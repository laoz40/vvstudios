import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import type { GetBookableRangeBusyWindowsResult } from "#convex/googleCalendar";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { availabilityErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import {
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getSelectedBusyDay,
	getUncachedMonthKeys,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow
} from "#studio/features/booking-form/lib/monthly-availability";
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

export function useBookingAvailability({
	date,
	duration,
	onSelectedTimeInvalidated,
	selectedTime
}: UseBookingAvailabilityOptions): BookingAvailabilityState {
	// Convex reads and actions
	const getBookableRangeBusyWindows = useAction(api.googleCalendar.getBookableRangeBusyWindows);
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
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Bookable month range
	const bookableMonthKeys = useMemo(() => {
		const startDate = parseDateValue(bookableStartDateValue);
		const endDate = parseDateValue(bookableEndDateValue);

		return startDate && endDate ? getBookableMonthKeys(startDate, endDate) : [];
	}, [bookableStartDateValue, bookableEndDateValue]);

	// Visible month state
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = date ? date.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !date || selectedMonth === visibleMonth;
	const isAvailabilityRateLimited =
		availabilityError === availabilityErrorMessages.GOOGLE_CALENDAR_RATE_LIMITED;

	// Load the saved availability rate limit key
	useEffect(() => {
		setAvailabilityRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	// Fetch calendar availability for uncached bookable months
	useEffect(() => {
		if (!availabilityRateLimitKey) {
			return;
		}

		const rateLimitKey = availabilityRateLimitKey;
		const uncachedMonthKeys = getUncachedMonthKeys(bookableMonthKeys, monthlyBusyWindowsByMonth);
		if (uncachedMonthKeys.length === 0) {
			setAvailabilityError("");
			setIsLoadingMonthAvailability(false);
			return;
		}

		let isCancelled = false;
		setAvailabilityError("");
		setIsLoadingMonthAvailability(true);

		async function loadAvailability() {
			const [error, result] = await tryCatch<GetBookableRangeBusyWindowsResult>(
				getBookableRangeBusyWindows({ rateLimitKey })
			);

			if (isCancelled) {
				return;
			}

			if (error !== null) {
				const errorMessage = availabilityErrorMessages[error.reason];

				console.error("Booking availability failed", { reason: error.reason });

				setAvailabilityError(errorMessage);
				toast.error(errorMessage);
				setIsLoadingMonthAvailability(false);
				return;
			}

			setMonthlyBusyWindowsByMonth((current) =>
				mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result })
			);
			setIsLoadingMonthAvailability(false);
		}

		void loadAvailability();

		return () => {
			isCancelled = true;
		};
	}, [
		availabilityRateLimitKey,
		bookableMonthKeys,
		getBookableRangeBusyWindows,
		monthlyBusyWindowsByMonth
	]);

	// Selected day availability
	const selectedBusyDay = date
		? getSelectedBusyDay({ date, monthlyBusyWindowsByMonth, selectedMonth })
		: null;

	// Calendar disabled dates
	const disabledDates = useMemo(() => {
		return (disabledDate: Date) =>
			isBookingDateDisabled({
				currentTimestamp,
				date: disabledDate,
				duration,
				isAvailabilityRateLimited,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				settings: availabilitySettings,
				today
			});
	}, [
		currentTimestamp,
		duration,
		isAvailabilityRateLimited,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		availabilitySettings,
		today
	]);

	// Available times for the selected date
	const availableTimes = useMemo<string[]>(() => {
		return getBookableAvailableTimes({
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
		});
	}, [
		currentTimestamp,
		date,
		duration,
		availabilitySettings,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
		selectedDate,
		lastBookableDate,
		today
	]);

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

		if (availableTimes.length === 0) {
			if (selectedTime) {
				onSelectedTimeInvalidated();
			}
			return;
		}

		if (selectedTime && !availableTimes.includes(selectedTime)) {
			onSelectedTimeInvalidated();
		}
	}, [
		availableTimes,
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
		availableTimes,
		calendarMonth,
		disabledDates,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isViewingSelectedMonth,
		selectedDate,
		setAvailabilityError,
		setCalendarMonth
	};
}
