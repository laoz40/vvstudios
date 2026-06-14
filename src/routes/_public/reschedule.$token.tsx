import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import type { GetAvailableRescheduleTimesResult } from "#convex/googleCalendar";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingProcessing } from "#studio/features/booking-complete/components/BookingProcessing";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import {
	formatBookingDate,
	formatBookingTimeRange,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime,
	parseDateValue,
	startOfToday
} from "#studio/lib/bookingdatetime";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";

type RescheduleLinkInvalidContent = { title: string; description: string };

export const Route = createFileRoute("/_public/reschedule/$token")({
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: ReschedulePage
});

function ReschedulePage() {
	const { token } = Route.useParams();
	const getAvailableRescheduleTimes = useAction(api.googleCalendar.getAvailableRescheduleTimes);
	const getRescheduleBooking = useQuery(api.bookingReschedule.getRescheduleBookingByToken, { token });
	const [calendarMonth, setCalendarMonth] = useState(startOfToday);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [availableTimes, setAvailableTimes] = useState<string[]>([]);
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
	const [rescheduleLinkInvalidContent, setRescheduleLinkInvalidContent] =
		useState<RescheduleLinkInvalidContent | null>(null);
	const selectedDate = parseDateValue(selectedDateValue);
	const today = useMemo(() => startOfToday(), []);

	const loadAvailability = useCallback(
		async (dateValue: string, shouldSkipUpdate: () => boolean) => {
			setIsLoadingAvailability(true);
			setAvailabilityError("");

			const [error, data] = await tryCatch<GetAvailableRescheduleTimesResult>(
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

			setAvailableTimes(data.times);
		},
		[getAvailableRescheduleTimes, token]
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
	if (getRescheduleBooking === undefined) {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing label="Checking reschedule link" />
			</BookingStatusLayout>
		);
	}

	const [error, data] = getRescheduleBooking;

	let invalidTitle = rescheduleLinkInvalidContent?.title ?? "";
	let invalidDescription = rescheduleLinkInvalidContent?.description ?? "";

	if (error !== null) {
		invalidTitle = "This reschedule link is no longer valid.";
		invalidDescription = "Please use the reschedule button in your latest invoice email.";
	}

	if (invalidTitle && invalidDescription) {
		return (
			<BookingStatusLayout bookingStatus="failed">
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidTitle}</h1>
					<p className="mt-4 text-muted-foreground">{invalidDescription}</p>
				</div>
			</BookingStatusLayout>
		);
	}
	const formattedDate = formatBookingDate(data.booking.date);
	const formattedTime = formatBookingTimeRange(data.booking.time, data.booking.duration);
	const addonsLabel = data.booking.addons.length > 0 ? data.booking.addons.join(", ") : "None";
	const disabledDates = (date: Date) => date < today;

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl">
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
									{data.booking.service} ({data.booking.duration})
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
						isLoadingAvailability={isLoadingAvailability}
						isSelectedDateInPast={false}
						isViewingSelectedMonth
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

				<div className="mt-6 flex justify-center">
					<span>
						selected: {selectedDateValue || "No date"} {selectedTime || "No time"}
					</span>
				</div>
				<p className="mt-2 text-center text-sm text-muted-foreground">
					Reschedule link expires {formatBookingTimestampTime(data.expiresAt)},{" "}
					{formatBookingTimestampDateLong(data.expiresAt)}
				</p>
			</div>
		</BookingStatusLayout>
	);
}
