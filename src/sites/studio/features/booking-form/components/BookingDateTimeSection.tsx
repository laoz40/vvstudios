import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { Button } from "#/components/ui/button";
import { FieldError } from "#/components/ui/field";
import { Modal } from "#studio/components/Modal";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/form-shared";
import { formatBookingDateSummary, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

const sectionCopy = {
	dateLabel: "SESSION DATE *",
	timeLabel: "SESSION TIME *",
	modalCloseLabel: "Close dialog",
	sessionSummaryTitle: "Session selected",
	sessionSummaryDescription: "Review selected session time before continuing.",
	sessionSummaryAction: "Confirm"
} as const;

export interface BookingDateTimeSectionProps {
	availabilityError: string;
	availableTimes: string[];
	calendarMonth: Date;
	disabledDates: (date: Date) => boolean;
	isLoadingMonthAvailability: boolean;
	isSelectedDateInPast: boolean;
	isViewingSelectedMonth: boolean;
	selectedDate: Date | undefined;
	setCalendarMonth: (date: Date) => void;
}

export function BookingDateTimeSection({
	availabilityError,
	availableTimes,
	calendarMonth,
	disabledDates,
	isLoadingMonthAvailability,
	isSelectedDateInPast,
	isViewingSelectedMonth,
	selectedDate,
	setCalendarMonth
}: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const formValues = useStore(formApi.store, (state) => state.values as BookingFormValues);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const bookingDateSummary = formValues.date
		? formatBookingDateSummary(formValues.date)
		: "No selected date";
	const bookingTimeSummary = formValues.time
		? formValues.duration
			? formatBookingTimeRange(formValues.time, formValues.duration)
			: "No selected duration"
		: "No selected time";
	const [isSessionSummaryDialogOpen, setIsSessionSummaryDialogOpen] = useState(false);
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
		setIsSessionSummaryDialogOpen(true);
	}, [formValues.date, formValues.duration, formValues.time]);

	return (
		<section className="flex flex-col mt-0 gap-6 md:gap-8">
			<formApi.Field name="date">
				{(dateField) => (
					<formApi.Field name="time">
						{(timeField) => (
							<BookingDateTimePicker
								availabilityError={availabilityError}
								availableTimes={availableTimes}
								calendarMonth={calendarMonth}
								dateError={
									dateField.state.meta.isBlurred || shouldShowFieldError ? (
										<FieldError errors={toFieldErrorObjects(dateField.state.meta.errors)} />
									) : null
								}
								disabledDates={disabledDates}
								isLoadingAvailability={isLoadingMonthAvailability}
								isSelectedDateInPast={isSelectedDateInPast}
								isViewingSelectedMonth={isViewingSelectedMonth}
								onDateChange={(dateValue) => {
									dateField.handleChange(dateValue);
									dateField.handleBlur();
								}}
								onTimeChange={(time) => {
									timeField.handleChange(time as BookingFormValues["time"]);
									timeField.handleBlur();
								}}
								selectedDate={selectedDate}
								selectedTime={timeField.state.value}
								setCalendarMonth={setCalendarMonth}
								shouldPromptSelectDate={!formValues.date || !isViewingSelectedMonth}
								shouldPromptSelectDuration={Boolean(formValues.date && !formValues.duration)}
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
			<Modal
				open={isSessionSummaryDialogOpen}
				onOpenChange={setIsSessionSummaryDialogOpen}
				title={sectionCopy.sessionSummaryTitle}
				description={sectionCopy.sessionSummaryDescription}
				closeLabel={sectionCopy.modalCloseLabel}
				footer={
					<Button
						type="button"
						onClick={() => setIsSessionSummaryDialogOpen(false)}>
						{sectionCopy.sessionSummaryAction}
					</Button>
				}>
				<div className="grid gap-3 rounded-lg border bg-card p-4 text-center">
					<p className="text-foreground text-2xl font-semibold leading-tight">
						{bookingDateSummary}
					</p>
					<p className="text-foreground text-2xl font-semibold leading-tight">
						{bookingTimeSummary}
					</p>
				</div>
			</Modal>
		</section>
	);
}
