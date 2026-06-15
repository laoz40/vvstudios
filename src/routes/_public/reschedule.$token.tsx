import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { api } from "#convex/_generated/api";
import type {
	GetAvailableRescheduleTimesResult,
	GetRescheduleBookableRangeBusyWindowsResult,
	RescheduleBookingResult
} from "#convex/googleCalendar";
import { studioSite } from "#/config/sites";
import { BookingProcessing } from "#studio/features/booking-complete/components/BookingProcessing";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import {
	buildDevRescheduleBooking,
	getDevRescheduleAvailability,
	getDevRescheduleUpdateError,
	parseRescheduleSearch,
	RescheduleDevScenarioPanel
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatBookingDate,
	formatBookingTimeRange,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime,
	formatDateValue,
	formatMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";
import {
	getBookableMonthKeys,
	getUncachedMonthKeys,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow
} from "#studio/features/booking-form/lib/monthly-availability";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";

type RescheduleLinkInvalidContent = { title: string; description: string };

export const Route = createFileRoute("/_public/reschedule/$token")({
	validateSearch: parseRescheduleSearch,
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: ReschedulePage
});

function ReschedulePage() {
	const { token } = Route.useParams();
	const { dev_scenario: devScenario } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const navigate = useNavigate();
	const getAvailableRescheduleTimes = useAction(api.googleCalendar.getAvailableRescheduleTimes);
	const getRescheduleBookableRangeBusyWindows = useAction(
		api.googleCalendar.getRescheduleBookableRangeBusyWindows
	);
	const rescheduleBooking = useAction(api.googleCalendar.rescheduleBooking);
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const liveRescheduleBooking = useQuery(
		api.bookingReschedule.getRescheduleBookingByToken,
		activeDevScenario ? "skip" : { token }
	);
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [availableTimes, setAvailableTimes] = useState<string[]>([]);
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);
	const [rescheduleLinkInvalidContent, setRescheduleLinkInvalidContent] =
		useState<RescheduleLinkInvalidContent | null>(null);
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

	const loadAvailability = useCallback(
		async (dateValue: string, shouldSkipUpdate: () => boolean) => {
			setIsLoadingAvailability(true);
			setAvailabilityError("");

			const [error, data] = activeDevScenario
				? (() => {
						const devAvailability = getDevRescheduleAvailability(activeDevScenario);
						return [devAvailability.error, { times: devAvailability.times }] as const;
					})()
				: await tryCatch<GetAvailableRescheduleTimesResult>(
						getAvailableRescheduleTimes({ date: dateValue, token })
					);

			if (shouldSkipUpdate()) {
				return;
			}

			setIsLoadingAvailability(false);

			if (error !== null) {
				setAvailableTimes([]);

				switch (error.reason) {
					case "RESCHEDULE_LINK_NOT_FOUND":
						setRescheduleLinkInvalidContent({
							title: "This reschedule link could not be found.",
							description: "Please use the reschedule button in your latest invoice email."
						});
						return;

					case "RESCHEDULE_LINK_USED":
						setRescheduleLinkInvalidContent({
							title: "This reschedule link has already been used.",
							description: "Please use the newest reschedule link from your latest invoice email."
						});
						return;

					case "RESCHEDULE_LINK_EXPIRED":
						setRescheduleLinkInvalidContent({
							title: "This reschedule link has expired.",
							description: "Please contact us if you still need to move your session."
						});
						return;

					case "BOOKING_NOT_FOUND":
						setRescheduleLinkInvalidContent({
							title: "We could not find this booking.",
							description: "Please contact us and we’ll help you reschedule your session."
						});
						return;

					case "BOOKING_NOT_RESCHEDULABLE":
						setRescheduleLinkInvalidContent({
							title: "This booking can’t be rescheduled online.",
							description: "Please contact us and we’ll help you with your booking."
						});
						return;

					case "GOOGLE_CALENDAR_AUTH_FAILED":
					case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
						console.error("Failed to load reschedule availability", error);
						setAvailabilityError(
							"Availability could not load right now. Please contact us and we’ll help you find a time."
						);
						return;

					case "GOOGLE_CALENDAR_RATE_LIMITED":
						console.error("Failed to load reschedule availability", error);
						setAvailabilityError(
							"Availability is temporarily busy. Please wait a moment and try again."
						);
						return;

					case "UNEXPECTED_ERROR":
						setAvailabilityError(
							"Something went wrong while loading availability. Please try again."
						);
						return;

					default: {
						const _exhaustive: never = error;
						return _exhaustive;
					}
				}
			}

			setAvailableTimes([...data.times]);
		},
		[getAvailableRescheduleTimes, token, activeDevScenario]
	);
	useEffect(() => {
		if (!selectedDateValue) {
			setAvailableTimes([]);
			setAvailabilityError("");
			setIsLoadingAvailability(false);
			return;
		}

		let isCancelled = false;

		void loadAvailability(selectedDateValue, () => isCancelled);

		return () => {
			isCancelled = true;
		};
	}, [loadAvailability, selectedDateValue]);
	useEffect(() => {
		if (activeDevScenario) {
			return;
		}

		const uncachedMonthKeys = getUncachedMonthKeys(bookableMonthKeys, monthlyBusyWindowsByMonth);
		if (uncachedMonthKeys.length === 0) {
			setIsLoadingMonthAvailability(false);
			return;
		}

		let isCancelled = false;
		setIsLoadingMonthAvailability(true);

		async function loadMonthAvailability() {
			const [error, result] = await tryCatch<GetRescheduleBookableRangeBusyWindowsResult>(
				getRescheduleBookableRangeBusyWindows({ token })
			);

			if (isCancelled) {
				return;
			}

			setIsLoadingMonthAvailability(false);

			if (error !== null) {
				setAvailabilityError(
					"Availability could not load right now. Please contact us and we’ll help you find a time."
				);
				return;
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
		activeDevScenario,
		bookableMonthKeys,
		getRescheduleBookableRangeBusyWindows,
		monthlyBusyWindowsByMonth,
		token
	]);
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);
	useEffect(() => {
		if (!activeDevScenario) {
			return;
		}

		setRescheduleLinkInvalidContent(null);
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
				const devUpdateError = getDevRescheduleUpdateError(activeDevScenario);

				if (devUpdateError !== null) {
					switch (devUpdateError.reason) {
						case "BOOKING_INVALID_DATE":
							toast.error("Please choose a valid date.");
							return;

						case "BOOKING_INVALID_TIME":
							toast.error("Please choose a valid time.");
							return;

						case "BOOKING_TIME_UNAVAILABLE":
							toast.error("That time is no longer available. Please choose another time.");
							return;

						case "GOOGLE_CALENDAR_UPDATE_FAILED":
							toast.error("We couldn’t update the calendar. Please contact us and we’ll help you.");
							return;

						case "GOOGLE_CALENDAR_RATE_LIMITED":
							toast.error("Calendar is temporarily busy. Please wait a moment and try again.");
							return;

						case "UNEXPECTED_ERROR":
							toast.error("Something went wrong while updating your booking.");
							return;

						default: {
							const _exhaustive: never = devUpdateError;
							return _exhaustive;
						}
					}
				}

				await navigateToRescheduleComplete("dev-reschedule-booking");
				return;
			}

			const [rescheduleError, result] = await tryCatch<RescheduleBookingResult>(
				rescheduleBooking({ date: selectedDateValue, time: selectedTime, token })
			);

			if (rescheduleError !== null) {
				switch (rescheduleError.reason) {
					case "RESCHEDULE_LINK_NOT_FOUND":
						toast.error("This reschedule link could not be found.");
						return;

					case "RESCHEDULE_LINK_USED":
						toast.error("This reschedule link has already been used.");
						return;

					case "RESCHEDULE_LINK_EXPIRED":
						toast.error("This reschedule link has expired.");
						return;

					case "BOOKING_NOT_FOUND":
						toast.error("We could not find this booking.");
						return;

					case "BOOKING_NOT_RESCHEDULABLE":
						toast.error("This booking can’t be rescheduled online.");
						return;

					case "BOOKING_INVALID_DATE":
						toast.error("Please choose a valid date.");
						return;

					case "BOOKING_INVALID_TIME":
						toast.error("Please choose a valid time.");
						return;

					case "BOOKING_TIME_UNAVAILABLE":
						toast.error("That time is no longer available. Please choose another time.");
						return;

					case "GOOGLE_CALENDAR_AUTH_FAILED":
					case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
					case "GOOGLE_CALENDAR_CREATE_FAILED":
					case "GOOGLE_CALENDAR_UPDATE_FAILED":
						toast.error("We couldn’t update the calendar. Please contact us and we’ll help you.");
						return;

					case "GOOGLE_CALENDAR_RATE_LIMITED":
						toast.error("Calendar is temporarily busy. Please wait a moment and try again.");
						return;

					case "UNEXPECTED_ERROR":
						toast.error("Something went wrong while updating your booking.");
						return;

					default: {
						const _exhaustive: never = rescheduleError;
						return _exhaustive;
					}
				}
			}

			await navigateToRescheduleComplete(result.bookingId);
		} finally {
			setIsUpdatingBooking(false);
		}
	}

	if (rescheduleLinkInvalidContent !== null) {
		return (
			<BookingStatusLayout
				bookingStatus="failed"
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">
						{rescheduleLinkInvalidContent.title}
					</h1>
					<p className="mt-4 text-muted-foreground">{rescheduleLinkInvalidContent.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}
	const formattedDate = formatBookingDate(booking.date);
	const formattedTime = formatBookingTimeRange(booking.time, booking.duration);
	const addonsLabel = booking.addons.length > 0 ? booking.addons.join(", ") : "None";
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

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl"
			devPanel={<RescheduleDevScenarioPanel token={token} />}>
			<div>
				<h1 className="text-center font-brand text-[2.5rem] leading-none uppercase md:text-6xl">
					Reschedule your booking
				</h1>

				<h2 className="mt-6 text-xs! md:text-sm! font-semibold tracking-widest uppercase">
					Existing booking
				</h2>
				<div className="mt-2 rounded-lg border bg-card p-2 text-sm text-card-foreground">
					<dl className="grid gap-2 md:grid-cols-2">
						<div className="space-y-1">
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Date</dt>
								<dd className="font-medium">{formattedDate}</dd>
							</div>
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Time</dt>
								<dd className="font-medium">{formattedTime}</dd>
							</div>
						</div>
						<div className="space-y-1">
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Service</dt>
								<dd className="font-medium">
									{booking.service} ({booking.duration})
								</dd>
							</div>
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Add-ons</dt>
								<dd className="font-medium">{addonsLabel}</dd>
							</div>
						</div>
					</dl>
				</div>

				<div className="mt-8">
					<BookingDateTimePicker
						availabilityError={availabilityError}
						availableTimes={availableTimes}
						calendarMonth={calendarMonth}
						dateLabel="SESSION DATE *"
						disabledDates={disabledDates}
						isLoadingAvailability={isLoadingAvailability || isLoadingMonthAvailability}
						isSelectedDateInPast={false}
						isViewingSelectedMonth={isViewingSelectedMonth}
						onDateChange={(dateValue) => {
							setSelectedDateValue(dateValue);
							setSelectedTime("");
						}}
						onTimeChange={setSelectedTime}
						selectedDate={selectedDate}
						selectedTime={selectedTime}
						setCalendarMonth={setCalendarMonth}
						shouldPromptSelectDate={!selectedDateValue}
						timeLabel="SESSION TIME *"
					/>
				</div>

				<div className="mt-6">
					<Button
						type="button"
						className="w-full"
						disabled={!selectedDateValue || !selectedTime || isUpdatingBooking}
						onClick={handleUpdateBooking}>
						UPDATE BOOKING
					</Button>
				</div>
				<p className="mt-2 text-center text-sm text-muted-foreground">
					Reschedule link expires {formatBookingTimestampTime(data.expiresAt)},{" "}
					{formatBookingTimestampDateLong(data.expiresAt)}
				</p>
			</div>
		</BookingStatusLayout>
	);
}
