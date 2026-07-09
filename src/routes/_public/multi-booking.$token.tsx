import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type {
	ClearPackageSlotResult,
	GetPackageByTokenResult,
	SavePackageSlotResult
} from "#convex/packageScheduling";
import type { GetPackageBusyWindowsResult } from "#convex/packageSchedulingCalendar";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { PackageScheduleSummary } from "#studio/features/booking-form/components/PackageScheduleSummary";
import { PackageSessionsAccordion } from "#studio/features/booking-form/components/PackageSessionsAccordion";
import { getBookingTimeSelectionMessage } from "#studio/features/booking-form/lib/booking-form-model";
import {
	closeBookingModal,
	openPackageSlotConfirmationModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getClearPackageSlotToastMessage,
	getPackageAvailabilityErrorMessage,
	getPackageLinkInvalidMessage,
	getSavePackageSlotToastMessage
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

export const Route = createFileRoute("/_public/multi-booking/$token")({
	head: () => buildNoIndexHead("Schedule Package Sessions | VV Studios"),
	component: MultiBookingSchedulePage
});

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
	const savePackageSlot = useAction(api.packageScheduling.savePackageSlot);
	const clearPackageSlot = useAction(api.packageScheduling.clearPackageSlot);
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

	// Slot selection state
	const [activeSlotNumber, setActiveSlotNumber] = useState<number | null>(null);
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [savingSlotNumber, setSavingSlotNumber] = useState<number | null>(null);
	const [clearingSlotNumber, setClearingSlotNumber] = useState<number | null>(null);
	const [highlightedSlotNumber, setHighlightedSlotNumber] = useState<number | null>(null);

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
	const activeSession = packageData.sessions.find(
		(session) => session.slotNumber === activeSlotNumber
	);
	const visibleMonthlyBusyWindowsByMonth = useMemo(
		() => excludeBusyEvent(monthlyBusyWindowsByMonth, activeSession?.booking?.googleEventId),
		[activeSession?.booking?.googleEventId, monthlyBusyWindowsByMonth]
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
		if (highlightedSlotNumber === null) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setHighlightedSlotNumber(null);
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [highlightedSlotNumber]);

	function handleChooseSlot(slotNumber: number, dateValue?: string, time?: string) {
		setActiveSlotNumber(slotNumber);
		setSelectedDateValue(dateValue ?? "");
		setSelectedTime(time ?? "");
	}

	function handleCloseSlot() {
		setActiveSlotNumber(null);
	}

	function handleDateChange(dateValue: string) {
		setSelectedDateValue(dateValue);
		setSelectedTime("");
	}

	function handleRequestSaveSlot() {
		if (activeSlotNumber === null) {
			toast.error("Choose a session slot first.");
			return;
		}

		if (!selectedDateValue || !selectedTime) {
			toast.error("Please choose a date and time first.");
			return;
		}

		void handleSaveSlot({
			date: selectedDateValue,
			slotNumber: activeSlotNumber,
			time: selectedTime
		});
	}

	function handleRequestClearSlot(slotNumber: number, date: string) {
		openPackageSlotConfirmationModal({
			dateSummary: formatBookingDateSummary(date),
			modal: "packageSlotConfirmation",
			slotNumber,
			type: "clear"
		});
	}

	async function handleConfirmSlotAction() {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "packageSlotConfirmation") {
			return;
		}

		if (confirmation.type === "save") {
			await handleSaveSlot({
				date: confirmation.date,
				slotNumber: confirmation.slotNumber,
				time: confirmation.time
			});
			return;
		}

		await handleClearSlot(confirmation.slotNumber);
	}

	async function handleSaveSlot(confirmation: { date: string; slotNumber: number; time: string }) {
		setSavingSlotNumber(confirmation.slotNumber);
		const [saveError] = await tryCatch<SavePackageSlotResult>(
			savePackageSlot({
				date: confirmation.date,
				slotNumber: confirmation.slotNumber,
				time: confirmation.time,
				token
			})
		);
		setSavingSlotNumber(null);

		if (saveError !== null) {
			toast.error(getSavePackageSlotToastMessage(saveError, noticeWindowLabel));
			return;
		}

		closeBookingModal();
		setActiveSlotNumber(null);
		setHighlightedSlotNumber(confirmation.slotNumber);
		toast.success("Calendar event created. Check your email for the invitation.");
		setMonthlyBusyWindowsByMonth({});
	}

	async function handleClearSlot(slotNumber: number) {
		setClearingSlotNumber(slotNumber);
		const [clearError] = await tryCatch<ClearPackageSlotResult>(
			clearPackageSlot({ slotNumber, token })
		);
		setClearingSlotNumber(null);

		if (clearError !== null) {
			toast.error(getClearPackageSlotToastMessage(clearError, noticeWindowLabel));
			return;
		}

		closeBookingModal();
		setActiveSlotNumber(null);
		setHighlightedSlotNumber(slotNumber);
		setMonthlyBusyWindowsByMonth({});

		if (activeSlotNumber === slotNumber) {
			setSelectedDateValue("");
			setSelectedTime("");
		}

		toast.success(`Session ${slotNumber} cleared.`);
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

				<PackageScheduleSummary packageData={packageData} />

				<PackageSessionsAccordion
					activeSlotNumber={activeSlotNumber}
					availability={availability}
					clearingSlotNumber={clearingSlotNumber}
					highlightedSlotNumber={highlightedSlotNumber}
					packageData={packageData}
					savingSlotNumber={savingSlotNumber}
					selectedDateValue={selectedDateValue}
					selectedTime={selectedTime}
					timeSelectionMessage={timeSelectionMessage}
					currentTimestamp={currentTimestamp}
					leadTimeMinutes={availabilitySettings.leadTimeMinutes}
					onDateChange={handleDateChange}
					onRequestClearSlot={handleRequestClearSlot}
					onRequestSaveSlot={handleRequestSaveSlot}
					onSlotClose={handleCloseSlot}
					onSlotSelect={handleChooseSlot}
					onTimeChange={setSelectedTime}
				/>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until {noticeWindowLabel} before they start. Package scheduling
					expires {formatBookingTimestampTime(packageData.expiresAt)},{" "}
					{formatBookingTimestampDateLong(packageData.expiresAt)}.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={savingSlotNumber !== null || clearingSlotNumber !== null}
				onPackageSlotConfirm={handleConfirmSlotAction}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
