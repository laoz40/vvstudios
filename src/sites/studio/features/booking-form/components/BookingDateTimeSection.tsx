import { useSelector } from "@tanstack/react-store";
import { FieldError } from "#/components/ui/field";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { BookingSessionSummary } from "#studio/features/booking-form/components/BookingSessionSummary";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getBookingTimeSelectionMessage,
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
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
	return (
		<section className="mt-0 flex flex-col gap-4">
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
			<BookingSessionSummary
				dateSummary={bookingDateSummary}
				timeSummary={bookingTimeSummary}
			/>
		</section>
	);
}
