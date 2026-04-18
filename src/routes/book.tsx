import { useStore } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Calendar } from "#/components/ui/calendar";
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
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForBusyPeriods,
	getCurrentMonthKey,
	hasAvailableTimesForBusyPeriods,
	parseDateValue,
	parseMonthKey,
	startOfMonth,
	startOfToday,
	toOptionId,
	type BusyPeriod,
} from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

const SERVICES = ["Table Setup", "Open Setup"] as const;
const DURATION_OPTIONS = ["1h", "2h", "3h"] as const;
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

const bookingSchema = z.object({
	name: z.string().trim().min(2, "Name is required."),
	email: z.email("Enter a valid email address.").trim(),
	date: z.string().min(1, "Date is required."),
	time: z.string().min(1, "Time is required."),
	duration: z
		.union([z.literal(""), z.enum(DURATION_OPTIONS)])
		.refine((value) => value !== "", "Duration is required."),
	service: z
		.union([z.literal(""), z.enum(SERVICES)])
		.refine((value) => value !== "", "Service is required."),
	notes: z.string(),
});

type BookingFormValues = z.input<typeof bookingSchema>;
type ParsedBookingFormValues = z.output<typeof bookingSchema>;

interface SubmittedBooking {
	name: string;
	date: string;
	time: string;
	duration: ParsedBookingFormValues["duration"];
	service: ParsedBookingFormValues["service"];
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

const INITIAL_FORM: BookingFormValues = {
	name: "",
	email: "",
	date: "",
	time: "",
	duration: "",
	service: "",
	notes: "",
};

export const Route = createFileRoute("/book")({
	component: BookingPage,
});

function BookingPage() {
	const createBooking = useAction(api.googleCalendar.createBookingWithCalendarEvent);
	const getMonthlyBusyWindows = useAction(api.googleCalendar.getMonthlyBusyWindows);
	const today = startOfToday();

	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [submittedBooking, setSubmittedBooking] = useState<SubmittedBooking | null>(null);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const formApi = useForm({
		defaultValues: INITIAL_FORM,
		validators: {
			onBlur: bookingSchema,
			onSubmit: bookingSchema,
		},
		onSubmit: async ({ value, formApi: submittedFormApi }) => {
			const parsedValue = bookingSchema.parse(value);

			setError("");
			setIsSubmitting(true);

			try {
				await createBooking({
					name: parsedValue.name,
					email: parsedValue.email,
					date: parsedValue.date,
					time: parsedValue.time,
					duration: parsedValue.duration,
					service: parsedValue.service,
					notes: parsedValue.notes || undefined,
				});

				setSubmittedBooking({
					name: parsedValue.name,
					date: parsedValue.date,
					time: parsedValue.time,
					duration: parsedValue.duration,
					service: parsedValue.service,
				});
				submittedFormApi.reset(INITIAL_FORM);
				setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
			} catch (submissionError) {
				setError(getBookingErrorMessage(submissionError));
			} finally {
				setIsSubmitting(false);
			}
		},
	});
	const formValues = useStore(formApi.store, (state) => state.values);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	const selectedDate = parseDateValue(formValues.date);
	const isSelectedDateInPast = selectedDate ? selectedDate < today : false;
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = formValues.date ? formValues.date.slice(0, 7) : visibleMonth;

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

	const selectedBusyDay = !formValues.date
		? null
		: (monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === formValues.date) ??
			null);

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
				duration: formValues.duration,
			});
		};
	}, [formValues.duration, monthlyBusyWindowsByMonth, today]);

	const availableTimes = useMemo<string[]>(() => {
		if (!formValues.date || isSelectedDateInPast) {
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
			duration: formValues.duration,
		});
	}, [
		formValues.date,
		formValues.duration,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
		visibleMonth,
	]);

	const availableTimeSections = TIME_SECTIONS.map((section) => ({
		...section,
		times: availableTimes.filter(section.includes),
	})).filter((section) => section.times.length > 0);

	useEffect(() => {
		if (!formValues.date || isSelectedDateInPast) {
			if (formValues.time) {
				formApi.setFieldValue("time", "");
			}
			return;
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return;
		}

		if (availableTimes.length === 0) {
			if (formValues.time) {
				formApi.setFieldValue("time", "");
			}
			return;
		}

		if (formValues.time && !availableTimes.includes(formValues.time)) {
			formApi.setFieldValue("time", "");
		}
	}, [
		availableTimes,
		formApi,
		formValues.date,
		formValues.time,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		monthlyBusyWindowsByMonth,
		selectedMonth,
		visibleMonth,
	]);

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
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void formApi.handleSubmit();
				}}
				className="flex flex-col gap-8">
				<FieldGroup>
					<formApi.Field name="service">
						{(field) => (
							<FieldSet>
								<FieldLegend>Service *</FieldLegend>
								<RadioGroup
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as BookingFormValues["service"])
									}
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
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</FieldSet>
						)}
					</formApi.Field>

					<formApi.Field name="duration">
						{(field) => (
							<FieldSet>
								<FieldLegend>Duration *</FieldLegend>
								<RadioGroup
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as BookingFormValues["duration"])
									}
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
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</FieldSet>
						)}
					</formApi.Field>

					<div className="grid gap-6 xl:grid-cols-[max-content_minmax(0,1fr)] xl:items-start">
						<formApi.Field name="date">
							{(field) => (
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
												field.handleChange(formatDateValue(date));
												field.handleBlur();
											}}
										/>
									</div>
									{field.state.meta.isBlurred || shouldShowFieldError ? (
										<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
									) : null}
								</Field>
							)}
						</formApi.Field>

						<formApi.Field name="time">
							{(field) => (
								<FieldSet className="min-w-0">
									<FieldLegend>Time *</FieldLegend>
									<RadioGroup
										value={field.state.value}
										onValueChange={(value) => {
											field.handleChange(value);
											field.handleBlur();
										}}
										disabled={
											!formValues.date || isLoadingMonthAvailability || availableTimes.length === 0
										}
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
									{!formValues.date ? (
										<FieldDescription>Select a date to view times.</FieldDescription>
									) : null}
									{formValues.date && isSelectedDateInPast ? (
										<FieldDescription>Past dates are unavailable.</FieldDescription>
									) : null}
									{formValues.date && isLoadingMonthAvailability ? (
										<FieldDescription>Loading available times…</FieldDescription>
									) : null}
									{!isLoadingMonthAvailability &&
									formValues.date &&
									!isSelectedDateInPast &&
									availableTimes.length === 0 &&
									!availabilityError ? (
										<FieldDescription>No times available for this date.</FieldDescription>
									) : null}
									{availabilityError ? <FieldError>{availabilityError}</FieldError> : null}
									{field.state.meta.isBlurred || shouldShowFieldError ? (
										<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
									) : null}
								</FieldSet>
							)}
						</formApi.Field>
					</div>

					<formApi.Field name="name">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="name">Name *</FieldLabel>
								<Input
									id="name"
									type="text"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									required
								/>
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</Field>
						)}
					</formApi.Field>

					<formApi.Field name="email">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="email">Email *</FieldLabel>
								<Input
									id="email"
									type="email"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									required
								/>
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</Field>
						)}
					</formApi.Field>

					<formApi.Field name="notes">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="notes">Notes</FieldLabel>
								<Textarea
									id="notes"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									rows={4}
								/>
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</Field>
						)}
					</formApi.Field>
				</FieldGroup>

				{error ? <FieldError>{error}</FieldError> : null}

				<Button
					type="submit"
					className="w-fit"
					disabled={isSubmitting || !formValues.time || isLoadingMonthAvailability}>
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

function toFieldErrorObjects(errors: unknown[]) {
	return errors.flatMap((error) => {
		if (!error) {
			return [];
		}

		if (typeof error === "string") {
			return [{ message: error }];
		}

		if (typeof error === "object" && "message" in error) {
			const message = error.message;
			return typeof message === "string" ? [{ message }] : [];
		}

		return [];
	});
}
