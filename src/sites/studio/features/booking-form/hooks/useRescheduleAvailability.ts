import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import type { GetRescheduleBookableRangeBusyWindowsResult } from "#convex/googleCalendar";
import { tryCatch } from "#/lib/result";
import {
	getDevRescheduleAvailabilityStatus,
	type DevRescheduleScenario
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import {
	getBookingTimeSelectionMessage,
	type BookingTimeSelectionMessage
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getSelectedBusyDay,
	getUncachedMonthKeys,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import {
	getAvailabilityErrorMessage,
	getInvalidMessage,
	type RescheduleLinkInvalidContent
} from "#studio/features/booking-form/lib/reschedule-errors";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatDateValue,
	formatMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday
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

export function useRescheduleAvailability({
	activeDevScenario,
	duration,
	token
}: UseRescheduleAvailabilityOptions): RescheduleAvailabilityState {
	// Convex reads and actions
	const getRescheduleBookableRangeBusyWindows = useAction(
		api.googleCalendar.getRescheduleBookableRangeBusyWindows
	);
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	// Availability settings
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<BusyWindowsByMonth>(
		{}
	);
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Date and time selection
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [invalidLinkMessage, setInvalidLinkMessage] = useState<RescheduleLinkInvalidContent | null>(
		null
	);

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

	// Load the saved availability rate limit key
	useEffect(() => {
		setAvailabilityRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	// Apply dev-only availability scenarios
	useEffect(() => {
		if (!activeDevScenario) {
			return;
		}

		const devAvailabilityStatus = getDevRescheduleAvailabilityStatus(activeDevScenario);
		if (devAvailabilityStatus.kind !== "availabilityError") {
			setAvailabilityError("");
			return;
		}

		setAvailabilityError(getAvailabilityErrorMessage(devAvailabilityStatus.error));
	}, [activeDevScenario]);

	// Fetch calendar availability for uncached bookable months
	useEffect(() => {
		if (activeDevScenario || !availabilityRateLimitKey) {
			return undefined;
		}

		const rateLimitKey = availabilityRateLimitKey;
		const uncachedMonthKeys = getUncachedMonthKeys(bookableMonthKeys, monthlyBusyWindowsByMonth);
		if (uncachedMonthKeys.length === 0) {
			setIsLoadingMonthAvailability(false);
			return undefined;
		}

		let isCancelled = false;
		setIsLoadingMonthAvailability(true);

		async function loadMonthAvailability() {
			const [error, result] = await tryCatch<GetRescheduleBookableRangeBusyWindowsResult>(
				getRescheduleBookableRangeBusyWindows({ rateLimitKey, token })
			);

			if (isCancelled) {
				return;
			}

			setIsLoadingMonthAvailability(false);

			if (error !== null) {
				switch (error.reason) {
					case "RESCHEDULE_LINK_NOT_FOUND":
					case "RESCHEDULE_LINK_USED":
					case "RESCHEDULE_LINK_EXPIRED":
					case "BOOKING_NOT_FOUND":
					case "BOOKING_NOT_RESCHEDULABLE":
						setInvalidLinkMessage(getInvalidMessage(error));
						return;

					case "GOOGLE_CALENDAR_AUTH_FAILED":
					case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
					case "GOOGLE_CALENDAR_RATE_LIMITED":
					case "UNEXPECTED_ERROR":
						console.error("Failed to load reschedule availability", error);
						setAvailabilityError(getAvailabilityErrorMessage(error));
						return;

					default: {
						const _exhaustive: never = error;
						void _exhaustive;
						return;
					}
				}
			}

			setMonthlyBusyWindowsByMonth((current) =>
				mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result })
			);
		}

		void loadMonthAvailability();

		return () => {
			isCancelled = true;
		};
	}, [
		availabilityRateLimitKey,
		activeDevScenario,
		bookableMonthKeys,
		getRescheduleBookableRangeBusyWindows,
		monthlyBusyWindowsByMonth,
		token
	]);

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

		setInvalidLinkMessage(null);
		setSelectedTime("");
		setSelectedDateValue(formatDateValue(startOfToday()));
	}, [activeDevScenario]);

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
			settings: availabilitySettings,
			today
		});
	}

	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth
	});
	const disabledDates = (date: Date) =>
		isBookingDateDisabled({
			currentTimestamp,
			date,
			duration,
			isAvailabilityRateLimited: false,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			settings: availabilitySettings,
			today
		});

	return {
		availability: {
			availabilityError,
			availableTimes,
			calendarMonth,
			disabledDates,
			isLoadingMonthAvailability,
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
