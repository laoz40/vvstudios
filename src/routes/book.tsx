import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { type ComponentProps, useEffect, useMemo, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Calendar } from "#/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForBusyPeriods,
	hasAvailableTimesForBusyPeriods,
	getCurrentMonthKey,
	parseDateValue,
	parseMonthKey,
	startOfMonth,
	startOfToday,
	toOptionId,
	type BusyPeriod,
} from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

const SERVICES = ["Table Setup", "Open Setup"];
const DURATION_OPTIONS = ["1h", "2h", "3h"];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";

	return `${hours}:${minutes}`;
});

const TIME_SECTIONS = [
	{
		key: "morning",
		label: "Morning",
		includes: (time: string) => time < "12:00",
	},
	{
		key: "afternoon",
		label: "Afternoon",
		includes: (time: string) => time >= "12:00" && time < "17:00",
	},
	{
		key: "evening",
		label: "Evening",
		includes: (time: string) => time >= "17:00",
	},
] as const;

interface BookingFormState {
	name: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	notes: string;
}

interface SubmittedBooking {
	name: string;
	date: string;
	time: string;
	duration: string;
	service: string;
}

interface BookingErrorWithData {
	data?: {
		code?: string;
	};
}

interface BusyDayWindow {
	busyPeriods: BusyPeriod[];
	date: string;
	label: string;
}

const INITIAL_FORM: BookingFormState = {
	name: "",
	email: "",
	date: "",
	time: TIME_OPTIONS[18],
	duration: DURATION_OPTIONS[0],
	service: SERVICES[0],
	notes: "",
};

export const Route = createFileRoute("/book")({
	component: BookingPage,
});

function BookingPage() {
	const createBooking = useAction(api.googleCalendar.createBookingWithCalendarEvent);
	const getMonthlyBusyWindows = useAction(api.googleCalendar.getMonthlyBusyWindows);
	const today = useMemo(() => startOfToday(), []);

	const [form, setForm] = useState(INITIAL_FORM);
	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [submittedBooking, setSubmittedBooking] = useState<SubmittedBooking | null>(null);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const selectedDate = useMemo(() => parseDateValue(form.date), [form.date]);
	const isSelectedDateInPast = useMemo(
		() => (selectedDate ? selectedDate < today : false),
		[selectedDate, today],
	);
	const visibleMonth = useMemo(() => formatMonthKey(calendarMonth), [calendarMonth]);
	const selectedMonth = form.date ? form.date.slice(0, 7) : visibleMonth;

	useEffect(() => {
		const cachedBusyDays = monthlyBusyWindowsByMonth[visibleMonth];
		if (cachedBusyDays) {
			setAvailabilityError("");
			setIsLoadingMonthAvailability(false);
			return;
		}

		let isCancelled = false;
		setAvailabilityError("");
		setIsLoadingMonthAvailability(true);

		void getMonthlyBusyWindows({ month: visibleMonth })
			.then((result) => {
				if (isCancelled) {
					return;
				}

				setMonthlyBusyWindowsByMonth((current) => ({
					...current,
					[result.month]: result.busyWindows,
				}));
			})
			.catch((availabilityFetchError) => {
				if (isCancelled) {
					return;
				}

				setAvailabilityError(getBookingErrorMessage(availabilityFetchError));
				console.error("Could not load month availability", availabilityFetchError);
			})
			.finally(() => {
				if (!isCancelled) {
					setIsLoadingMonthAvailability(false);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [getMonthlyBusyWindows, monthlyBusyWindowsByMonth, visibleMonth]);

	const selectedBusyDay = useMemo(() => {
		if (!form.date) {
			return null;
		}

		return monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === form.date) ?? null;
	}, [form.date, monthlyBusyWindowsByMonth, selectedMonth]);

	const disabledDates = useMemo(() => {
		return (date: Date) => {
			if (date < today) {
				return true;
			}

			const monthKey = formatMonthKey(date);
			const busyDays = monthlyBusyWindowsByMonth[monthKey];
			if (!busyDays) {
				return false;
			}

			const busyDay = busyDays.find((day) => day.date === formatDateValue(date));
			if (!busyDay) {
				return false;
			}

			return !hasAvailableTimesForBusyPeriods({
				busyPeriods: busyDay.busyPeriods,
				duration: form.duration,
			});
		};
	}, [form.duration, monthlyBusyWindowsByMonth, today]);

	const availableTimes = useMemo(() => {
		if (!form.date || isSelectedDateInPast) {
			return [];
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return [];
		}

		return getAvailableTimesForBusyPeriods({
			busyPeriods: selectedBusyDay?.busyPeriods ?? [],
			duration: form.duration,
		});
	}, [
		form.date,
		form.duration,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
		visibleMonth,
	]);

	const availableTimeSections = useMemo(
		() =>
			TIME_SECTIONS.map((section) => ({
				...section,
				times: availableTimes.filter(section.includes),
			})).filter((section) => section.times.length > 0),
		[availableTimes],
	);

	useEffect(() => {
		if (!form.date || isSelectedDateInPast) {
			setForm((current) => (current.time ? { ...current, time: "" } : current));
			return;
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return;
		}

		setForm((current) => {
			if (availableTimes.length === 0) {
				return current.time ? { ...current, time: "" } : current;
			}

			if (availableTimes.includes(current.time)) {
				return current;
			}

			return { ...current, time: availableTimes[0] };
		});
	}, [
		availableTimes,
		form.date,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		monthlyBusyWindowsByMonth,
		selectedMonth,
		visibleMonth,
	]);

	const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);

		try {
			await createBooking({
				name: form.name,
				email: form.email,
				date: form.date,
				time: form.time,
				duration: form.duration,
				service: form.service,
				notes: form.notes || undefined,
			});

			setSubmittedBooking({
				name: form.name,
				date: form.date,
				time: form.time,
				duration: form.duration,
				service: form.service,
			});
			setForm(INITIAL_FORM);
			setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
		} catch (submissionError) {
			setError(getBookingErrorMessage(submissionError));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submittedBooking) {
		return (
			<main className="mx-auto flex max-w-3xl flex-col gap-4 py-8">
				<h1 className="text-3xl font-semibold">Booking confirmed</h1>
				<p>
					Thank you, {submittedBooking.name}. Your booking for{" "}
					<strong>{submittedBooking.service}</strong> on <strong>{submittedBooking.date}</strong> at{" "}
					<strong>{submittedBooking.time}</strong> for <strong>{submittedBooking.duration}</strong>{" "}
					has been received.
				</p>
				<Button
					type="button"
					className="w-fit"
					onClick={() => setSubmittedBooking(null)}>
					Create another booking
				</Button>
			</main>
		);
	}

	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Book</h1>
				<p className="text-muted-foreground">Choose your service, date, and available time.</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className="flex flex-col gap-8">
				<FieldGroup>
					<FieldSet>
						<FieldLegend>Service *</FieldLegend>
						<RadioGroup
							value={form.service}
							onValueChange={(service) => setForm((current) => ({ ...current, service }))}
							className="flex flex-wrap gap-3">
							{SERVICES.map((service) => (
								<FieldLabel
									key={service}
									className="cursor-pointer w-auto! flex-row! rounded-md border">
									<Field
										orientation="horizontal"
										className="w-auto items-center rounded-md px-3 py-2">
										<RadioGroupItem
											value={service}
											id={`service-${toOptionId(service)}`}
										/>
										<FieldTitle>{service}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Duration *</FieldLegend>
						<RadioGroup
							value={form.duration}
							onValueChange={(duration) => setForm((current) => ({ ...current, duration }))}
							className="flex flex-wrap gap-3">
							{DURATION_OPTIONS.map((duration) => (
								<FieldLabel
									key={duration}
									className="cursor-pointer w-auto! flex-row! rounded-md border">
									<Field
										orientation="horizontal"
										className="w-auto items-center rounded-md px-3 py-2">
										<RadioGroupItem
											value={duration}
											id={`duration-${toOptionId(duration)}`}
										/>
										<FieldTitle>{duration}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
					</FieldSet>

					<div className="grid gap-6 xl:grid-cols-[max-content_minmax(0,1fr)] xl:items-start">
						<Field>
							<FieldLabel>Date *</FieldLabel>
							<div className="w-fit rounded-md border bg-background">
								<Calendar
									mode="single"
									required
									disabled={disabledDates}
									month={calendarMonth}
									onMonthChange={setCalendarMonth}
									selected={selectedDate}
									onSelect={(date) => {
										if (!date) {
											return;
										}

										setCalendarMonth(startOfMonth(date));
										setForm((current) => ({ ...current, date: formatDateValue(date) }));
									}}
								/>
							</div>
						</Field>

						<FieldSet className="min-w-0">
							<FieldLegend>Time *</FieldLegend>
							<RadioGroup
								value={form.time}
								onValueChange={(time) => setForm((current) => ({ ...current, time }))}
								disabled={!form.date || isLoadingMonthAvailability || availableTimes.length === 0}
								className="flex flex-col gap-5">
								{availableTimeSections.map((section) => (
									<div
										key={section.key}
										className="flex flex-col gap-3">
										<p className="text-sm font-medium text-muted-foreground">{section.label}</p>
										<div className="flex flex-wrap gap-2">
											{section.times.map((time) => (
												<FieldLabel
													key={time}
													className="cursor-pointer w-auto! flex-row! rounded-md border">
													<Field
														orientation="horizontal"
														className="w-auto items-center rounded-md px-2.5 py-1.5">
														<RadioGroupItem
															value={time}
															id={`time-${toOptionId(time)}`}
														/>
														<FieldTitle>{time}</FieldTitle>
													</Field>
												</FieldLabel>
											))}
										</div>
									</div>
								))}
							</RadioGroup>
							{!form.date ? (
								<FieldDescription>Select a date to view times.</FieldDescription>
							) : null}
							{form.date && isSelectedDateInPast ? (
								<FieldDescription>Past dates are unavailable.</FieldDescription>
							) : null}
							{form.date && isLoadingMonthAvailability ? (
								<FieldDescription>Loading available times…</FieldDescription>
							) : null}
							{!isLoadingMonthAvailability &&
							form.date &&
							!isSelectedDateInPast &&
							availableTimes.length === 0 &&
							!availabilityError ? (
								<FieldDescription>No times available for this date.</FieldDescription>
							) : null}
							{availabilityError ? <FieldError>{availabilityError}</FieldError> : null}
						</FieldSet>
					</div>

					<Field>
						<FieldLabel htmlFor="name">Name *</FieldLabel>
						<Input
							id="name"
							type="text"
							value={form.name}
							onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="email">Email *</FieldLabel>
						<Input
							id="email"
							type="email"
							value={form.email}
							onChange={(event) =>
								setForm((current) => ({ ...current, email: event.target.value }))
							}
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="notes">Notes</FieldLabel>
						<Textarea
							id="notes"
							value={form.notes}
							onChange={(event) =>
								setForm((current) => ({ ...current, notes: event.target.value }))
							}
							rows={4}
						/>
					</Field>
				</FieldGroup>

				{error ? <FieldError>{error}</FieldError> : null}

				<Button
					type="submit"
					className="w-fit"
					disabled={isSubmitting || !form.time || isLoadingMonthAvailability}>
					{isSubmitting ? "Submitting..." : "Create booking"}
				</Button>
			</form>
		</main>
	);
}

function getBookingErrorMessage(error: unknown) {
	const errorWithData =
		typeof error === "object" && error !== null ? (error as BookingErrorWithData) : null;
	const code = errorWithData?.data?.code;

	if (code === "BOOKING_TIME_UNAVAILABLE") {
		return "That time was just taken. Please choose another available time.";
	}

	if (code === "GOOGLE_CALENDAR_AUTH_FAILED") {
		return "Google Calendar authentication failed. Regenerate the refresh token and try again.";
	}

	if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
		return "Could not load availability right now. Check the Convex logs for the Google error details.";
	}

	return error instanceof Error ? error.message : "Something went wrong.";
}
