import { useStore } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingContactSection } from "#/features/booking-form/components/BookingContactSection";
import { BookingDateTimeSection } from "#/features/booking-form/components/BookingDateTimeSection.tsx";
import { BookingRecordingSpaceDurationSection } from "#/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingAddonsSection } from "#/features/booking-form/components/BookingAddonsSection.tsx";
import {
	bookingFormContext,
	type BookingFormApi,
} from "#/features/booking-form/lib/booking-form-context";
import {
	bookingSchema,
	INITIAL_FORM,
	TIME_SECTIONS,
} from "#/features/booking-form/lib/form-shared";
import {
	persistSubmittedBooking,
	type SubmittedBooking,
} from "#/features/booking-form/lib/submitted-booking";
import { Button } from "#/components/ui/button";
import { FieldError, FieldGroup } from "#/components/ui/field";
import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForDate,
	getCurrentMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday,
	type BusyPeriod,
} from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

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

export const Route = createFileRoute("/book")({
	component: BookingPage,
});

function BookingPage() {
	const navigate = useNavigate();
	const createBooking = useAction(api.googleCalendar.createBookingWithCalendarEvent);
	const getMonthlyBusyWindows = useAction(api.googleCalendar.getMonthlyBusyWindows);
	const today = startOfToday();
	const lastBookableDate = getLastBookableDate(today);
	const formRef = useRef<HTMLFormElement>(null);

	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

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
					phone: parsedValue.phone,
					accountName: parsedValue.accountName,
					abn: parsedValue.abn || undefined,
					email: parsedValue.email,
					date: parsedValue.date,
					time: parsedValue.time,
					duration: parsedValue.duration,
					service: parsedValue.service,
					addons: parsedValue.addons,
					notes: parsedValue.notes || undefined,
				});

				const submittedBooking: SubmittedBooking = {
					name: parsedValue.name,
					phone: parsedValue.phone,
					accountName: parsedValue.accountName,
					abn: parsedValue.abn ?? "",
					email: parsedValue.email,
					date: parsedValue.date,
					time: parsedValue.time,
					duration: parsedValue.duration,
					service: parsedValue.service,
					addons: parsedValue.addons,
				};

				persistSubmittedBooking(submittedBooking);
				submittedFormApi.reset(INITIAL_FORM);
				setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
				await navigate({ to: "/booking-complete" });
			} catch (submissionError) {
				setError(getBookingErrorMessage(submissionError));
			} finally {
				setIsSubmitting(false);
			}
		},
	});
	const formValues = useStore(formApi.store, (state) => state.values);
	const selectedDate = parseDateValue(formValues.date);
	const isSelectedDateInPast = selectedDate ? selectedDate < today : false;
	const isSelectedDateTooFarInFuture = selectedDate ? selectedDate > lastBookableDate : false;
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = formValues.date ? formValues.date.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !formValues.date || selectedMonth === visibleMonth;

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
		console.log("Loading month availability", {
			month: visibleMonth,
			selectedDate: formValues.date || null,
		});

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
	}, [formValues.date, getMonthlyBusyWindows, monthlyBusyWindowsByMonth, visibleMonth]);

	const selectedBusyDay = !formValues.date
		? null
		: (monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === formValues.date) ??
			null);

	const disabledDates = useMemo(() => {
		return (date: Date) => {
			if (date < today || date > lastBookableDate) {
				return true;
			}

			const monthKey = formatMonthKey(date);
			const busyDays = monthlyBusyWindowsByMonth[monthKey];
			const busyDay = busyDays?.find((day) => day.date === formatDateValue(date));
			const availableTimesForDate = getAvailableTimesForDate({
				busyPeriods: busyDay?.busyPeriods ?? [],
				currentTimestamp,
				dateValue: formatDateValue(date),
				duration: formValues.duration,
			});

			if (!busyDays) {
				return availableTimesForDate.length === 0;
			}

			return availableTimesForDate.length === 0;
		};
	}, [currentTimestamp, formValues.duration, lastBookableDate, monthlyBusyWindowsByMonth, today]);

	const availableTimes = useMemo<string[]>(() => {
		if (
			!formValues.date ||
			isSelectedDateInPast ||
			isSelectedDateTooFarInFuture ||
			!isViewingSelectedMonth
		) {
			return [];
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return [];
		}

		return getAvailableTimesForDate({
			busyPeriods: selectedBusyDay?.busyPeriods ?? [],
			currentTimestamp,
			dateValue: formValues.date,
			duration: formValues.duration,
		});
	}, [
		currentTimestamp,
		formValues.date,
		formValues.duration,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
		visibleMonth,
	]);

	const availableTimeSections = TIME_SECTIONS.map((section) => ({
		...section,
		times: availableTimes.filter(section.includes),
	})).filter((section) => section.times.length > 0);

	const scrollToFirstError = () => {
		requestAnimationFrame(() => {
			const fieldOrder = [
				"service",
				"duration",
				"date",
				"time",
				"name",
				"phone",
				"accountName",
				"abn",
				"email",
				"notes",
			];

			for (const fieldName of fieldOrder) {
				const fieldContainer = formRef.current?.querySelector<HTMLElement>(
					`[data-field-name="${fieldName}"]`,
				);
				const fieldError = fieldContainer?.querySelector<HTMLElement>('[data-slot="field-error"]');

				if (fieldContainer && fieldError) {
					fieldContainer.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
					return;
				}
			}
		});
	};

	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	useEffect(() => {
		if (
			!formValues.date ||
			isSelectedDateInPast ||
			isSelectedDateTooFarInFuture ||
			!isViewingSelectedMonth
		) {
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
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedMonth,
		visibleMonth,
	]);

	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Book</h1>
				<p className="text-muted-foreground">Choose your service, date, and available time.</p>
			</div>

			<bookingFormContext.Provider value={formApi as unknown as BookingFormApi}>
				<form
					ref={formRef}
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void formApi.handleSubmit().then(() => {
							if (!formApi.state.isValid) {
								scrollToFirstError();
							}
						});
					}}
					className="flex flex-col gap-8">
					<FieldGroup>
						<BookingRecordingSpaceDurationSection />
						<BookingDateTimeSection
							availabilityError={availabilityError}
							availableTimeSections={availableTimeSections}
							calendarMonth={calendarMonth}
							disabledDates={disabledDates}
							isLoadingMonthAvailability={isLoadingMonthAvailability}
							isSelectedDateInPast={isSelectedDateInPast}
							isViewingSelectedMonth={isViewingSelectedMonth}
							selectedDate={selectedDate}
							setCalendarMonth={setCalendarMonth}
						/>
						<BookingAddonsSection />
						<BookingContactSection />
					</FieldGroup>

					{error ? <FieldError>{error}</FieldError> : null}

					<Button
						type="submit"
						className="w-fit"
						disabled={isSubmitting}>
						{isSubmitting ? "Submitting..." : "Create booking"}
					</Button>
				</form>
			</bookingFormContext.Provider>
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
