import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { usePackageCalendarBusyWindows } from "#studio/features/booking-form/hooks/usePackageCalendarBusyWindows";
import {
	getBookingTimeSelectionMessage,
	recordingSpaceSchema,
	type BookingFormValues,
	type BookingTimeSelectionMessage
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	excludeBusyEvent,
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getNextAvailableBookingDate,
	getSelectedBusyDay,
	isBookingDateDisabled,
	isBookingDateUnavailable,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import type { PackageSession } from "#studio/features/booking-form/lib/package-scheduling-session";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { BusyPeriod } from "#studio/lib/bookingdatetime";
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

type SessionSelectionState = {
	activeSessionKey: string | null;
	highlightedBookingId: Id<"bookings"> | null;
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: BookingFormValues["service"];
	selectedTime: string;
};

interface UsePackageScheduleOptions {
	packageData: PackageData;
	token: string;
}

interface PackageDatePickerOptions {
	availableTimes: string[];
	disabledDates: (date: Date) => boolean;
	nextAvailableDate: Date | undefined;
	selectedBusyPeriods: BusyPeriod[];
	unavailableDates: (date: Date) => boolean;
}

export interface PackageScheduleState extends SessionSelectionState {
	activeBooking: PackageSession | undefined;
	availability: BookingAvailabilityPickerState;
	availabilitySettings: BookingAvailabilitySettings;
	clearSessionSelection: () => void;
	currentTimestamp: number;
	handleChooseSession: (sessionKey: string, dateValue?: string, time?: string) => void;
	handleCloseSession: () => void;
	handleDateChange: (dateValue: string) => void;
	handleRemotePodcastChange: (checked: boolean) => void;
	invalidateCalendarCache: () => void;
	noticeWindowLabel: string;
	setHighlightedBookingId: (bookingId: Id<"bookings"> | null) => void;
	setSelectedNotes: (notes: string) => void;
	setSelectedService: (service: Exclude<BookingFormValues["service"], "">) => void;
	setSelectedTime: (time: string) => void;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
}

function getPackageDatePickerOptions({
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
}): PackageDatePickerOptions {
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

export function usePackageSchedule({
	packageData,
	token
}: UsePackageScheduleOptions): PackageScheduleState {
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);
	const [sessionSelection, setSessionSelection] = useState<SessionSelectionState>({
		activeSessionKey: null,
		highlightedBookingId: null,
		selectedDateValue: "",
		selectedNotes: "",
		selectedRemotePodcast: false,
		selectedService: "",
		selectedTime: ""
	});

	const calendarView = useMemo(() => {
		const today = startOfToday();
		const selectedDate = parseDateValue(sessionSelection.selectedDateValue);
		const expiresDateValue = formatDateValue(new Date(packageData.expiresAt));
		const lastBookableDate = parseDateValue(expiresDateValue) ?? today;
		const bookableMonthKeys = getBookableMonthKeys(today, lastBookableDate);
		const visibleMonth = formatMonthKey(calendarMonth);
		const selectedMonth = sessionSelection.selectedDateValue
			? sessionSelection.selectedDateValue.slice(0, 7)
			: visibleMonth;

		return {
			bookableMonthKeys,
			isViewingSelectedMonth: !sessionSelection.selectedDateValue || selectedMonth === visibleMonth,
			lastBookableDate,
			selectedDate,
			selectedMonth,
			today
		};
	}, [calendarMonth, packageData.expiresAt, sessionSelection.selectedDateValue]);

	const activeBooking = packageData.sessions.find(
		(booking) => booking._id === sessionSelection.activeSessionKey
	);
	const { busyWindowsByMonth, calendarLoadError, invalidateCalendarCache, isLoadingCalendar } =
		usePackageCalendarBusyWindows({ bookableMonthKeys: calendarView.bookableMonthKeys, token });
	const busyWindowsForPicker = useMemo(
		() => excludeBusyEvent(busyWindowsByMonth, activeBooking?.googleEventId),
		[activeBooking?.googleEventId, busyWindowsByMonth]
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

	// Fade the updated session border back after the success highlight.
	useEffect(() => {
		if (sessionSelection.highlightedBookingId === null) {
			return undefined;
		}

		const timeout = window.setTimeout(() => {
			setSessionSelection((current) => ({ ...current, highlightedBookingId: null }));
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [sessionSelection.highlightedBookingId]);

	const datePickerOptions = getPackageDatePickerOptions({
		currentTimestamp,
		duration: packageData.duration,
		isViewingSelectedMonth: calendarView.isViewingSelectedMonth,
		lastBookableDate: calendarView.lastBookableDate,
		monthlyBusyWindowsByMonth: busyWindowsForPicker,
		selectedDate: calendarView.selectedDate,
		selectedDateValue: sessionSelection.selectedDateValue,
		selectedMonth: calendarView.selectedMonth,
		settings: availabilitySettings,
		today: calendarView.today
	});
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(sessionSelection.selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth: calendarView.isViewingSelectedMonth
	});
	const noticeWindowLabel = formatNoticeWindowLabel(availabilitySettings.leadTimeMinutes);

	function clearSessionSelection() {
		setSessionSelection((current) => ({
			...current,
			selectedDateValue: "",
			selectedNotes: "",
			selectedRemotePodcast: false,
			selectedService: "",
			selectedTime: ""
		}));
	}

	function handleChooseSession(sessionKey: string, dateValue?: string, time?: string) {
		const booking = packageData.sessions.find((session) => session._id === sessionKey);
		setSessionSelection({
			activeSessionKey: sessionKey,
			highlightedBookingId: null,
			selectedDateValue: dateValue ?? "",
			selectedNotes: booking?.notes ?? "",
			selectedRemotePodcast: booking?.addons.includes("Remote Podcast") ?? false,
			selectedService:
				recordingSpaceSchema.safeParse(booking?.service ?? packageData.defaultSpace).data ?? "",
			selectedTime: time ?? ""
		});
	}

	function handleCloseSession() {
		setSessionSelection((current) => ({ ...current, activeSessionKey: null }));
	}

	function handleDateChange(dateValue: string) {
		setSessionSelection((current) => ({
			...current,
			selectedDateValue: dateValue,
			selectedTime: ""
		}));
	}

	function handleRemotePodcastChange(checked: boolean) {
		setSessionSelection((current) => ({ ...current, selectedRemotePodcast: checked }));
	}

	function setHighlightedBookingId(bookingId: Id<"bookings"> | null) {
		setSessionSelection((current) => ({ ...current, highlightedBookingId: bookingId }));
	}

	function setSelectedNotes(notes: string) {
		setSessionSelection((current) => ({ ...current, selectedNotes: notes }));
	}

	function setSelectedService(service: Exclude<BookingFormValues["service"], "">) {
		setSessionSelection((current) => ({ ...current, selectedService: service }));
	}

	function setSelectedTime(time: string) {
		setSessionSelection((current) => ({ ...current, selectedTime: time }));
	}

	return {
		...sessionSelection,
		activeBooking,
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
			isViewingSelectedMonth: calendarView.isViewingSelectedMonth,
			selectedDate: calendarView.selectedDate,
			setCalendarMonth
		},
		availabilitySettings,
		clearSessionSelection,
		currentTimestamp,
		handleChooseSession,
		handleCloseSession,
		handleDateChange,
		handleRemotePodcastChange,
		invalidateCalendarCache,
		noticeWindowLabel,
		setHighlightedBookingId,
		setSelectedNotes,
		setSelectedService,
		setSelectedTime,
		timeSelectionMessage
	};
}
