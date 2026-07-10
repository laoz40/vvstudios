import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type {
	CreatePackageBookingResult,
	GetPackageByTokenResult,
	ReschedulePackageBookingResult,
	UnschedulePackageBookingResult
} from "#convex/packageScheduling";
import type { GetPackageBusyWindowsResult } from "#convex/packageSchedulingCalendar";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { PackageSessionDetailsModal } from "#studio/features/booking-form/components/PackageSessionDetailsModal";
import { PackageSessionsAccordion } from "#studio/features/booking-form/components/PackageSessionsAccordion";
import { getBookingTimeSelectionMessage } from "#studio/features/booking-form/lib/booking-form-model";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import {
	closeBookingModal,
	openPackageUnscheduleConfirmationModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getUnschedulePackageBookingToastMessage,
	getPackageAvailabilityErrorMessage,
	getPackageLinkInvalidMessage,
	getSavePackageBookingToastMessage
} from "#studio/features/booking-form/lib/package-scheduling-errors";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatBookingDateSummary,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime,
	formatDateValue,
	formatMonthKey,
	getCurrentTimestamp,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";
import {
	excludeBusyEvent,
	getBookableAvailableTimes,
	getBookableMonthKeys,
	getSelectedBusyDay,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow
} from "#studio/features/booking-form/lib/monthly-availability";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/package-schedule/$token")({
	head: () => buildNoIndexHead("Schedule Package Sessions | VV Studios"),
	component: MultiBookingSchedulePage
});

type SavePackageBookingResult = CreatePackageBookingResult | ReschedulePackageBookingResult;

function MultiBookingSchedulePage() {
	const { token } = Route.useParams();
	const packageResult = useQuery(api.packageScheduling.getPackageByToken, { token });

	if (packageResult === undefined) {
		return (
			<BookingStatusLayout showActions={false}>
				<StudioLoadingState label="Getting your package..." />
			</BookingStatusLayout>
		);
	}

	const [packageError, packageData] = packageResult;

	if (packageError !== null) {
		const invalidMessage = getPackageLinkInvalidMessage(packageError);
		return (
			<BookingStatusLayout bookingStatus="failed">
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}

	return (
		<PackageScheduleContent
			packageData={packageData}
			token={token}
		/>
	);
}

function PackageScheduleContent({
	packageData,
	token
}: {
	packageData: NonNullable<GetPackageByTokenResult[1]>;
	token: string;
}) {
	// Convex functions
	const getPackageBusyWindows = useAction(api.packageSchedulingCalendar.getPackageBusyWindows);
	const createPackageBooking = useAction(api.packageScheduling.createPackageBooking);
	const reschedulePackageBooking = useAction(api.packageScheduling.reschedulePackageBooking);
	const unschedulePackageBooking = useAction(api.packageScheduling.unschedulePackageBooking);
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	// Availability state
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Session selection state
	const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedNotes, setSelectedNotes] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
	const [unschedulingBookingId, setUnschedulingBookingId] = useState<Id<"bookings"> | null>(null);
	const [highlightedBookingId, setHighlightedBookingId] = useState<Id<"bookings"> | null>(null);

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
	const activeBooking = packageData.bookings.find((booking) => booking._id === activeSessionKey);
	const visibleMonthlyBusyWindowsByMonth = useMemo(
		() => excludeBusyEvent(monthlyBusyWindowsByMonth, activeBooking?.googleEventId),
		[activeBooking?.googleEventId, monthlyBusyWindowsByMonth]
	);

	// Load the saved availability rate limit key.
	useEffect(() => {
		setAvailabilityRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	// Keep lock and lead-time checks fresh.
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// Load package-specific calendar availability up to the package expiry date.
	useEffect(() => {
		if (!availabilityRateLimitKey || availabilityError) {
			return;
		}

		const rateLimitKey = availabilityRateLimitKey;
		const hasAllMonthsCached = bookableMonthKeys.every((month) => monthlyBusyWindowsByMonth[month]);
		if (bookableMonthKeys.length === 0 || hasAllMonthsCached) {
			return;
		}

		let isCancelled = false;
		setIsLoadingMonthAvailability(true);

		async function loadPackageAvailability() {
			const [busyWindowsError, result] = await tryCatch<GetPackageBusyWindowsResult>(
				getPackageBusyWindows({ rateLimitKey, token })
			);

			if (isCancelled) {
				return;
			}

			setIsLoadingMonthAvailability(false);

			if (busyWindowsError !== null) {
				console.error("Failed to load package availability", busyWindowsError);
				setAvailabilityError(getPackageAvailabilityErrorMessage(busyWindowsError));
				return;
			}

			setMonthlyBusyWindowsByMonth((current) =>
				mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result })
			);
		}

		void loadPackageAvailability();

		return () => {
			isCancelled = true;
		};
	}, [
		availabilityError,
		availabilityRateLimitKey,
		bookableMonthKeys,
		getPackageBusyWindows,
		monthlyBusyWindowsByMonth,
		token
	]);

	// Fade the updated session border back after the success highlight.
	useEffect(() => {
		if (highlightedBookingId === null) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setHighlightedBookingId(null);
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [highlightedBookingId]);

	function handleChooseSession(sessionKey: string, dateValue?: string, time?: string) {
		const booking = packageData.bookings.find((session) => session._id === sessionKey);
		setActiveSessionKey(sessionKey);
		setSelectedDateValue(dateValue ?? "");
		setSelectedNotes(booking?.notes ?? "");
		setSelectedTime(time ?? "");
	}

	function handleCloseSession() {
		setActiveSessionKey(null);
	}

	function handleDateChange(dateValue: string) {
		setSelectedDateValue(dateValue);
		setSelectedTime("");
	}

	function handleRequestSaveSession() {
		if (activeSessionKey === null) {
			toast.error("Choose a session first.");
			return;
		}

		if (!selectedDateValue || !selectedTime) {
			toast.error("Please choose a date and time first.");
			return;
		}

		void handleSaveSession();
	}

	function handleRequestUnschedule(bookingId: Id<"bookings">, date: string) {
		openPackageUnscheduleConfirmationModal({
			bookingId,
			dateSummary: formatBookingDateSummary(date),
			modal: "packageUnscheduleConfirmation",
			type: "unschedule"
		});
	}

	async function handleConfirmUnschedule() {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "packageUnscheduleConfirmation") {
			return;
		}

		await handleUnschedule(confirmation.bookingId);
	}

	async function handleSaveSession() {
		if (activeSessionKey === null) {
			return;
		}

		setSavingSessionKey(activeSessionKey);
		const saveAction = activeBooking
			? reschedulePackageBooking({
					bookingId: activeBooking._id,
					date: selectedDateValue,
					time: selectedTime,
					notes: selectedNotes,
					token
				})
			: createPackageBooking({
					date: selectedDateValue,
					time: selectedTime,
					notes: selectedNotes,
					token
				});
		const [saveError, saveResult] = await tryCatch<SavePackageBookingResult>(saveAction);
		setSavingSessionKey(null);

		if (saveError !== null) {
			toast.error(getSavePackageBookingToastMessage(saveError, noticeWindowLabel));
			return;
		}

		closeBookingModal();
		setActiveSessionKey(null);
		setHighlightedBookingId(saveResult.bookingId);
		toast.success(
			activeBooking
				? "Session rescheduled. Check your email for the updated invitation."
				: "Calendar event created. Check your email for the invitation."
		);
		setMonthlyBusyWindowsByMonth({});
	}

	async function handleUnschedule(bookingId: Id<"bookings">) {
		setUnschedulingBookingId(bookingId);
		const [unscheduleError] = await tryCatch<UnschedulePackageBookingResult>(
			unschedulePackageBooking({ bookingId, token })
		);
		setUnschedulingBookingId(null);

		if (unscheduleError !== null) {
			toast.error(getUnschedulePackageBookingToastMessage(unscheduleError, noticeWindowLabel));
			return;
		}

		closeBookingModal();
		setActiveSessionKey(null);
		setHighlightedBookingId(null);
		setMonthlyBusyWindowsByMonth({});

		if (activeSessionKey === bookingId) {
			setSelectedDateValue("");
			setSelectedNotes("");
			setSelectedTime("");
		}

		toast.success("Session unscheduled.");
	}

	const selectedBusyDay = selectedDateValue
		? getSelectedBusyDay({
				date: selectedDateValue,
				monthlyBusyWindowsByMonth: visibleMonthlyBusyWindowsByMonth,
				selectedMonth
			})
		: null;
	const availableTimes = getBookableAvailableTimes({
		currentTimestamp,
		duration: packageData.duration,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth: visibleMonthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedDate,
		selectedDateValue,
		selectedMonth,
		settings: availabilitySettings,
		today
	});
	const disabledDates = (date: Date) =>
		isBookingDateDisabled({
			currentTimestamp,
			date,
			duration: packageData.duration,
			isAvailabilityRateLimited: false,
			lastBookableDate,
			monthlyBusyWindowsByMonth: visibleMonthlyBusyWindowsByMonth,
			settings: availabilitySettings,
			today
		});
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth
	});
	const availability = {
		availabilityError,
		availableTimes,
		calendarMonth,
		disabledDates,
		isLoadingMonthAvailability,
		isSelectedDateInPast: false,
		isViewingSelectedMonth,
		selectedDate,
		setCalendarMonth
	};
	const noticeWindowLabel = formatNoticeWindowLabel(availabilitySettings.leadTimeMinutes);

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl justify-start pt-16 sm:pt-20">
			<div>
				<h1 className="text-left font-brand text-5xl leading-none uppercase md:text-center md:text-6xl">
					Schedule your package sessions
				</h1>

				<div className="mt-8 text-left sm:text-center">
					<p className="text-xl font-semibold">
						You have {packageData.packageSize - packageData.bookings.length} sessions left to
						schedule.
					</p>
					<p className="mt-2 text-muted-foreground">
						Scheduling expires {formatBookingTimestampTime(packageData.expiresAt)},{" "}
						{formatBookingTimestampDateLong(packageData.expiresAt)}.
					</p>
				</div>

				<div className="mt-8 flex items-center justify-start gap-4">
					<h2 className={sectionHeadingClassName}>Your Sessions</h2>
					<PackageSessionDetailsModal packageData={packageData} />
				</div>

				<PackageSessionsAccordion
					activeSessionKey={activeSessionKey}
					availability={availability}
					highlightedBookingId={highlightedBookingId}
					packageData={packageData}
					savingSessionKey={savingSessionKey}
					selectedDateValue={selectedDateValue}
					selectedNotes={selectedNotes}
					selectedTime={selectedTime}
					timeSelectionMessage={timeSelectionMessage}
					currentTimestamp={currentTimestamp}
					leadTimeMinutes={availabilitySettings.leadTimeMinutes}
					onDateChange={handleDateChange}
					onNotesChange={setSelectedNotes}
					onRequestUnschedule={handleRequestUnschedule}
					onRequestSaveSession={handleRequestSaveSession}
					onSessionClose={handleCloseSession}
					onSessionSelect={handleChooseSession}
					onTimeChange={setSelectedTime}
				/>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until {noticeWindowLabel} before they start.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={savingSessionKey !== null || unschedulingBookingId !== null}
				onPackageUnscheduleConfirm={handleConfirmUnschedule}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
