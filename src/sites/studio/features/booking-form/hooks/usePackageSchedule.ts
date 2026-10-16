import { useEffect, useMemo, useReducer, useState } from "react";
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
	initialPackageSessionEditorState,
	reducePackageSessionEditor,
	type PackageSessionDraft
} from "#studio/features/booking-form/lib/package-session-editor-machine";
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
	FunctionReturnType<typeof api.packages.scheduling.getPackageByToken>[1]
>;

interface SessionSelectionState extends PackageSessionDraft {
	activeSessionKey: string | null;
	highlightedBookingId: Id<"bookings"> | null;
}

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
	const bookingSettings = useQuery(api.booking.settings.get, {});
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;

	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);

	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	const [sessionSelection, dispatch] = useReducer(
		reducePackageSessionEditor,
		initialPackageSessionEditorState
	);

	const [highlightedBookingId, setHighlightedBookingId] = useState<Id<"bookings"> | null>(null);

	const calendarView = useMemo(() => {
		const today = startOfToday();
		const selectedDate = parseDateValue(sessionSelection.selectedDateValue);
		const expiresAt = packageData.expiresAt ?? getCurrentTimestamp();
		const expiresDateValue = formatDateValue(new Date(expiresAt));
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
		if (highlightedBookingId === null) {
			return undefined;
		}

		const timeout = window.setTimeout(() => {
			setHighlightedBookingId(null);
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [highlightedBookingId]);

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
		dispatch({ type: "draftCleared" });
	}

	function handleChooseSession(sessionKey: string, dateValue?: string, time?: string) {
		const booking = packageData.sessions.find((session) => session._id === sessionKey);

		const selectedService =
			recordingSpaceSchema.safeParse(booking?.service ?? packageData.defaultSpace).data ?? "";

		setHighlightedBookingId(null);
		dispatch({
			type: "sessionChosen",
			sessionKey,
			draft: {
				selectedDateValue: dateValue ?? "",
				selectedNotes: booking?.notes ?? "",
				selectedRemotePodcast: booking?.addons.includes("Remote Podcast") ?? false,
				selectedService,
				selectedTime: time ?? ""
			}
		});
	}

	function handleCloseSession() {
		dispatch({ type: "editorClosed" });
	}

	function handleDateChange(dateValue: string) {
		dispatch({ type: "dateChanged", dateValue });
	}

	function handleRemotePodcastChange(checked: boolean) {
		dispatch({ type: "remotePodcastChanged", checked });
	}

	function setSelectedNotes(notes: string) {
		dispatch({ type: "notesChanged", notes });
	}

	function setSelectedService(service: Exclude<BookingFormValues["service"], "">) {
		dispatch({ type: "serviceChanged", service });
	}

	function setSelectedTime(time: string) {
		dispatch({ type: "timeChanged", time });
	}

	return {
		activeSessionKey: sessionSelection.activeSessionKey,
		selectedDateValue: sessionSelection.selectedDateValue,
		selectedNotes: sessionSelection.selectedNotes,
		selectedRemotePodcast: sessionSelection.selectedRemotePodcast,
		selectedService: sessionSelection.selectedService,
		selectedTime: sessionSelection.selectedTime,
		highlightedBookingId,
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
