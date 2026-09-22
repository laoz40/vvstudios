import { useEffect, type RefObject } from "react";
import { useSelector } from "@tanstack/react-store";
import { FieldError } from "#/components/ui/field";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { useBookingAvailability } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	bookingFieldBlurValidator,
	getBookingTimeSelectionMessage,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";

type BookingDateTimeSectionProps = {
	dateTimeSectionRef: RefObject<HTMLDivElement | null>;
	setAvailabilityErrorRef?: RefObject<((message: string) => void) | null>;
};

export function BookingDateTimeSection({
	dateTimeSectionRef,
	setAvailabilityErrorRef
}: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const bookingMode = useSelector(formApi.store, (state) => state.values.bookingMode);
	const date = useSelector(formApi.store, (state) => state.values.date);
	const time = useSelector(formApi.store, (state) => state.values.time);
	const duration = useSelector(formApi.store, (state) => state.values.duration);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	function handleSelectedTimeInvalidated() {
		formApi.setFieldValue("time", "");
	}

	const availability = useBookingAvailability({
		date,
		duration,
		onSelectedTimeInvalidated: handleSelectedTimeInvalidated,
		selectedTime: time
	});

	// Wire dev tooling without rerendering the page shell.
	useEffect(() => {
		if (setAvailabilityErrorRef) {
			setAvailabilityErrorRef.current = availability.setAvailabilityError;
		}
	}, [availability, setAvailabilityErrorRef]);

	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(date),
		hasDuration: Boolean(duration),
		isViewingSelectedMonth: availability.isViewingSelectedMonth
	});

	if (bookingMode !== "single") {
		return null;
	}

	return (
		<div
			ref={dateTimeSectionRef}
			className="scroll-mt-32 sm:scroll-mt-40">
			<section className="mt-0 flex flex-col gap-4">
				<formApi.Field
					name="date"
					validators={bookingFieldBlurValidator("date")}>
					{(dateField) => (
						<formApi.Field
							name="time"
							validators={bookingFieldBlurValidator("time")}>
							{(timeField) => (
								<BookingDateTimePicker
									availability={availability}
									dateError={
										dateField.state.meta.isBlurred || shouldShowFieldError ? (
											<FieldError errors={toFieldErrorObjects(dateField.state.meta.errors)} />
										) : null
									}
									duration={duration}
									onDateChange={(dateValue) => {
										dateField.handleChange(dateValue);
										dateField.handleBlur();
									}}
									onTimeChange={(nextTime) => {
										timeField.handleChange(nextTime);
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
		</div>
	);
}
