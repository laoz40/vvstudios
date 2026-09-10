import { useSelector } from "@tanstack/react-store";
import { FieldError } from "#/components/ui/field";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getBookingTimeSelectionMessage,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";

export interface BookingDateTimeSectionProps {
	availability: BookingAvailabilityPickerState;
}

export function BookingDateTimeSection({ availability }: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const formValues = useSelector(formApi.store, (state) => state.values);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(formValues.date),
		hasDuration: Boolean(formValues.duration),
		isViewingSelectedMonth: availability.isViewingSelectedMonth
	});
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
								duration={formValues.duration}
								onDateChange={(dateValue) => {
									dateField.handleChange(dateValue);
									dateField.handleBlur();
								}}
								onTimeChange={(time) => {
									timeField.handleChange(time);
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
		</section>
	);
}
