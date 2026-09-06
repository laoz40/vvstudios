import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { usePackageCalendarBusyWindows } from "#studio/features/booking-form/hooks/usePackageCalendarBusyWindows";
import {
	getBookingTimeSelectionMessage,
	type BookingFormValues,
	type BookingTimeSelectionMessage
} from "#studio/features/booking-form/lib/booking-form-model";
import { excludeBusyEvent } from "#studio/features/booking-form/lib/monthly-availability";
import {
	confirmPackageSessionUnschedule,
	emptyPackageSessionDraft,
	getPackageSessionDraftForKey,
	requestPackageSessionSave,
	savePackageDefaultSpace,
	savePackageSession,
	unschedulePackageSessionBooking,
	type PackageSessionDraft
} from "#studio/features/booking-form/lib/package-scheduling-actions";
import {
	getPackageDatePickerOptions,
	getPackageScheduleCalendarView
} from "#studio/features/booking-form/lib/package-scheduling-calendar";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import type { PackageSession } from "#studio/features/booking-form/lib/package-scheduling-session";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatMonthKey,
	getCurrentTimestamp,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

interface UsePackageScheduleOptions {
	packageData: PackageData;
	token: string;
}

interface PackageScheduleState {
	activeSessionKey: string | null;
	availability: BookingAvailabilityPickerState;
	availabilitySettings: BookingAvailabilitySettings;
	currentTimestamp: number;
	handleChooseSession: (sessionKey: string, dateValue?: string, time?: string) => void;
	handleCloseSession: () => void;
	handleConfirmUnschedule: () => Promise<void>;
	handleDateChange: (dateValue: string) => void;
	handleMakeDefaultSpace: () => Promise<void>;
	handleRemotePodcastChange: (checked: boolean) => void;
	handleRequestSaveSession: () => void;
	highlightedBookingId: Id<"bookings"> | null;
	isSavingDefaultSpace: boolean;
	noticeWindowLabel: string;
	savingSessionKey: string | null;
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: BookingFormValues["service"];
	selectedTime: string;
	setSelectedNotes: (notes: string) => void;
	setSelectedService: (service: Exclude<BookingFormValues["service"], "">) => void;
	setSelectedTime: (time: string) => void;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
	unschedulingBookingId: Id<"bookings"> | null;
}

export function usePackageSchedule({
	packageData,
	token
}: UsePackageScheduleOptions): PackageScheduleState {
	const createPackageSession = useAction(api.packageScheduling.createPackageSession);
	const setDefaultSpace = useMutation(api.packageScheduling.setDefaultSpace);
	const reschedulePackageSession = useAction(api.packageScheduling.reschedulePackageSession);
	const unschedulePackageSession = useAction(api.packageScheduling.unschedulePackageSession);
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);
	const [sessionDraft, setSessionDraft] = useState<PackageSessionDraft>(emptyPackageSessionDraft);
	const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
	const [isSavingDefaultSpace, setIsSavingDefaultSpace] = useState(false);
	const [unschedulingBookingId, setUnschedulingBookingId] = useState<Id<"bookings"> | null>(null);

	const calendarView = getPackageScheduleCalendarView({
		calendarMonth,
		expiresAt: packageData.expiresAt,
		selectedDateValue: sessionDraft.selectedDateValue
	});
	const activeBooking: PackageSession | undefined = packageData.sessions.find(
		(booking) => booking._id === sessionDraft.activeSessionKey
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
		if (sessionDraft.highlightedBookingId === null) {
			return undefined;
		}

		const timeout = window.setTimeout(() => {
			setSessionDraft((current) => ({ ...current, highlightedBookingId: null }));
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [sessionDraft.highlightedBookingId]);

	const datePickerOptions = getPackageDatePickerOptions({
		currentTimestamp,
		duration: packageData.duration,
		isViewingSelectedMonth: calendarView.isViewingSelectedMonth,
		lastBookableDate: calendarView.lastBookableDate,
		monthlyBusyWindowsByMonth: busyWindowsForPicker,
		selectedDate: calendarView.selectedDate,
		selectedDateValue: sessionDraft.selectedDateValue,
		selectedMonth: calendarView.selectedMonth,
		settings: availabilitySettings,
		today: calendarView.today
	});
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(sessionDraft.selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth: calendarView.isViewingSelectedMonth
	});
	const noticeWindowLabel = formatNoticeWindowLabel(availabilitySettings.leadTimeMinutes);
	const mutationContext = {
		activeBooking,
		createPackageSession,
		invalidateCalendarCache,
		noticeWindowLabel,
		reschedulePackageSession,
		sessionDraft,
		setSavingSessionKey,
		setSessionDraft,
		setUnschedulingBookingId,
		token,
		unschedulePackageSession
	};

	return {
		activeSessionKey: sessionDraft.activeSessionKey,
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
		currentTimestamp,
		handleChooseSession: (sessionKey, dateValue, time) => {
			setSessionDraft(getPackageSessionDraftForKey(packageData, sessionKey, dateValue, time));
		},
		handleCloseSession: () => {
			setSessionDraft((current) => ({ ...current, activeSessionKey: null }));
		},
		handleConfirmUnschedule: () =>
			confirmPackageSessionUnschedule((bookingId) =>
				unschedulePackageSessionBooking(bookingId, mutationContext)
			),
		handleDateChange: (dateValue) => {
			setSessionDraft((current) => ({
				...current,
				selectedDateValue: dateValue,
				selectedTime: ""
			}));
		},
		handleMakeDefaultSpace: async () => {
			setIsSavingDefaultSpace(true);
			await savePackageDefaultSpace(sessionDraft.selectedService, setDefaultSpace, token);
			setIsSavingDefaultSpace(false);
		},
		handleRemotePodcastChange: (checked) => {
			setSessionDraft((current) => ({ ...current, selectedRemotePodcast: checked }));
		},
		handleRequestSaveSession: () =>
			requestPackageSessionSave(sessionDraft, () => savePackageSession(mutationContext)),
		highlightedBookingId: sessionDraft.highlightedBookingId,
		isSavingDefaultSpace,
		noticeWindowLabel,
		savingSessionKey,
		selectedDateValue: sessionDraft.selectedDateValue,
		selectedNotes: sessionDraft.selectedNotes,
		selectedRemotePodcast: sessionDraft.selectedRemotePodcast,
		selectedService: sessionDraft.selectedService,
		selectedTime: sessionDraft.selectedTime,
		setSelectedNotes: (notes) => {
			setSessionDraft((current) => ({ ...current, selectedNotes: notes }));
		},
		setSelectedService: (service) => {
			setSessionDraft((current) => ({ ...current, selectedService: service }));
		},
		setSelectedTime: (time) => {
			setSessionDraft((current) => ({ ...current, selectedTime: time }));
		},
		timeSelectionMessage,
		unschedulingBookingId
	};
}
