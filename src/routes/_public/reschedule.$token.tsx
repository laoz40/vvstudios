import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { api } from "#convex/_generated/api";
import type {
	GetRescheduleBookableRangeBusyWindowsResult,
	RescheduleBookingResult
} from "#convex/googleCalendar";
import { studioSite } from "#/config/sites";
import { BookingProcessing } from "#studio/features/booking-complete/components/BookingProcessing";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import {
	buildDevRescheduleBooking,
	getDevRescheduleAvailabilityStatus,
	getDevRescheduleUpdateResult,
	parseRescheduleSearch,
	RescheduleDevScenarioPanel
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import { RescheduleBookingSummary } from "#studio/components/booking/RescheduleBookingSummary";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime,
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForDate,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";
import {
	getBookableMonthKeys,
	getSelectedBusyDay,
	getUncachedMonthKeys,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow
} from "#studio/features/booking-form/lib/monthly-availability";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import { getBookingTimeSelectionMessage } from "#studio/features/booking-form/lib/form-shared";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";
import {
	getAvailabilityErrorMessage,
	getInvalidMessage,
	getRescheduleUpdateToastMessage,
	type RescheduleLinkInvalidContent
} from "#studio/features/booking-form/lib/reschedule-errors";

export const Route = createFileRoute("/_public/reschedule/$token")({
	validateSearch: parseRescheduleSearch,
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: ReschedulePage
});

function ReschedulePage() {
	// Route and navigation
	const { token } = Route.useParams();
	const { dev_scenario: devScenario } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const navigate = useNavigate();

	// Convex reads and actions
	const getRescheduleBookableRangeBusyWindows = useAction(
		api.googleCalendar.getRescheduleBookableRangeBusyWindows
	);
	const rescheduleBooking = useAction(api.googleCalendar.rescheduleBooking);
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const liveRescheduleBooking = useQuery(
		api.bookingReschedule.getRescheduleBookingByToken,
		activeDevScenario ? "skip" : { token }
	);

	// Availability settings
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Date and time selection
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");

	// Page status
	const [invalidLinkMessage, setInvalidLinkMessage] = useState<RescheduleLinkInvalidContent | null>(
		null
	);
	const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
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
			return;
		}

		const rateLimitKey = availabilityRateLimitKey;

		const uncachedMonthKeys = getUncachedMonthKeys(bookableMonthKeys, monthlyBusyWindowsByMonth);
		if (uncachedMonthKeys.length === 0) {
			setIsLoadingMonthAvailability(false);
			return;
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
						return _exhaustive;
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

	// Keep time-based availability fresh
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// Reset selection when switching dev scenarios
	useEffect(() => {
		if (!activeDevScenario) {
			return;
		}

		setInvalidLinkMessage(null);
		setSelectedTime("");
		setSelectedDateValue(formatDateValue(startOfToday()));
	}, [activeDevScenario]);

	const getRescheduleBooking = activeDevScenario
		? buildDevRescheduleBooking(activeDevScenario)
		: liveRescheduleBooking;

	if (getRescheduleBooking === undefined) {
		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<BookingProcessing label="Checking reschedule link" />
			</BookingStatusLayout>
		);
	}

	const [error, data] = getRescheduleBooking;

	if (isUpdatingBooking) {
		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<BookingProcessing label="Updating booking" />
			</BookingStatusLayout>
		);
	}

	if (error !== null) {
		return (
			<BookingStatusLayout
				bookingStatus="failed"
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">
						This reschedule link is no longer valid.
					</h1>
					<p className="mt-4 text-muted-foreground">
						Please use the reschedule button in your latest invoice email.
					</p>
				</div>
			</BookingStatusLayout>
		);
	}

	const booking = data.booking;
	async function navigateToRescheduleComplete(bookingId: string): Promise<void> {
		await navigate({
			to: studioSite.routes.rescheduleComplete,
			search: { booking_id: bookingId },
			replace: true
		});
	}

	async function handleUpdateBooking(): Promise<void> {
		if (!selectedDateValue || !selectedTime) {
			toast.error("Please choose a new date and time first.");
			return;
		}

		setIsUpdatingBooking(true);

		try {
			if (activeDevScenario) {
				const [devUpdateError, devUpdate] = getDevRescheduleUpdateResult(activeDevScenario);

				if (devUpdateError !== null) {
					toast.error(getRescheduleUpdateToastMessage(devUpdateError));
					return;
				}

				await navigateToRescheduleComplete(devUpdate.bookingId);
				return;
			}

			const [rescheduleError, result] = await tryCatch<RescheduleBookingResult>(
				rescheduleBooking({ date: selectedDateValue, time: selectedTime, token })
			);

			if (rescheduleError !== null) {
				toast.error(getRescheduleUpdateToastMessage(rescheduleError));
				return;
			}

			await navigateToRescheduleComplete(result.bookingId);
		} finally {
			setIsUpdatingBooking(false);
		}
	}

	if (invalidLinkMessage !== null) {
		return (
			<BookingStatusLayout
				bookingStatus="failed"
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidLinkMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidLinkMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}
	const selectedBusyDay = selectedDateValue
		? getSelectedBusyDay({ date: selectedDateValue, monthlyBusyWindowsByMonth, selectedMonth })
		: null;
	const availableTimes = (() => {
		if (activeDevScenario) {
			const devAvailabilityStatus = getDevRescheduleAvailabilityStatus(activeDevScenario);
			return devAvailabilityStatus.kind === "ready" ? [...devAvailabilityStatus.times] : [];
		}

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
			duration: booking.duration,
			settings: availabilitySettings
		});
	})();
	const disabledDates = (date: Date) =>
		isBookingDateDisabled({
			currentTimestamp,
			date,
			duration: booking.duration,
			isAvailabilityRateLimited: false,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
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

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl"
			devPanel={<RescheduleDevScenarioPanel token={token} />}>
			<div>
				<h1 className="text-center font-brand text-[2.5rem] leading-none uppercase md:text-6xl">
					Reschedule your booking
				</h1>

				<RescheduleBookingSummary
					addons={booking.addons}
					date={booking.date}
					duration={booking.duration}
					service={booking.service}
					time={booking.time}
				/>

				<div className="mt-12">
					<BookingDateTimePicker
						availability={availability}
						onDateChange={(dateValue) => {
							setSelectedDateValue(dateValue);

							setSelectedTime("");
						}}
						onTimeChange={setSelectedTime}
						selectedTime={selectedTime}
						timeSelectionMessage={timeSelectionMessage}
					/>
				</div>

				<div className="mt-6">
					<Button
						type="button"
						className="h-12 w-full rounded-lg text-base font-bold! tracking-wider shadow-lg shadow-primary/45"
						disabled={!selectedDateValue || !selectedTime || isUpdatingBooking}
						onClick={handleUpdateBooking}>
						UPDATE BOOKING
					</Button>
				</div>
				<p className="mt-4 text-center text-xs text-muted-foreground">
					Reschedule link expires {formatBookingTimestampTime(data.expiresAt)},{" "}
					{formatBookingTimestampDateLong(data.expiresAt)}
				</p>
			</div>
		</BookingStatusLayout>
	);
}
