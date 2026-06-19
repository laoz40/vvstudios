import { useEffect, useRef } from "react";
import { useSelector } from "@tanstack/react-store";
import { FieldError } from "#/components/ui/field";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { openSessionSummaryModal } from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getBookingTimeSelectionMessage,
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/form-shared";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/lib/use-booking-availability";
import { formatBookingDateSummary, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface BookingDateTimeSectionProps {
	availability: BookingAvailabilityPickerState;
}

export function BookingDateTimeSection({ availability }: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const formValues = useSelector(formApi.store, (state) => state.values as BookingFormValues);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(formValues.date),
		hasDuration: Boolean(formValues.duration),
		isViewingSelectedMonth: availability.isViewingSelectedMonth
	});
	const bookingDateSummary = formValues.date
		? formatBookingDateSummary(formValues.date)
		: "No selected date";
	const bookingTimeSummary = formValues.time
		? formValues.duration
			? formatBookingTimeRange(formValues.time, formValues.duration)
			: "No selected duration"
		: "No selected time";
	const lastSessionSummarySelectionRef = useRef<string | null>(null);

	useEffect(() => {
		if (!formValues.date || !formValues.time || !formValues.duration) {
			lastSessionSummarySelectionRef.current = null;
			return;
		}

		const selectionKey = `${formValues.date}-${formValues.time}-${formValues.duration}`;

		if (lastSessionSummarySelectionRef.current === selectionKey) {
			return;
		}

		lastSessionSummarySelectionRef.current = selectionKey;
		openSessionSummaryModal({ dateSummary: bookingDateSummary, timeSummary: bookingTimeSummary });
	}, [
		bookingDateSummary,
		bookingTimeSummary,
		formValues.date,
		formValues.duration,
		formValues.time
	]);

	return (
		<section className="flex flex-col mt-0 gap-6 md:gap-8">
			<formApi.Field name="date">
				{(dateField) => (
					<formApi.Field name="time">
						{(timeField) => (
							<BookingDateTimePicker
								availability={availability}
								dateError={
									dateField.state.meta.isBlurred || shouldShowFieldError ? (
										<FieldError errors={toFieldErrorObjects(dateField.state.meta.errors)} />
									) : null
								}
								onDateChange={(dateValue) => {
									dateField.handleChange(dateValue);
									dateField.handleBlur();
								}}
								onTimeChange={(time) => {
									timeField.handleChange(time as BookingFormValues["time"]);
									timeField.handleBlur();
								}}
								selectedTime={timeField.state.value}
								timeSelectionMessage={timeSelectionMessage}
								timeError={
									timeField.state.meta.isBlurred || shouldShowFieldError ? (
										<FieldError errors={toFieldErrorObjects(timeField.state.meta.errors)} />
									) : null
								}
							/>
						)}
					</formApi.Field>
				)}
			</formApi.Field>
			{/* <div
				aria-live="polite"
				className="text-muted-foreground flex min-h-10 flex-col gap-1 text-sm sm:flex-row sm:gap-8">
				<p>
					Date: <span className="text-foreground font-medium">{bookingDateSummary}</span>
				</p>
				<p>
					Time: <span className="text-foreground font-medium">{bookingTimeSummary}</span>
				</p>
			</div> */}
		</section>
	);
}
