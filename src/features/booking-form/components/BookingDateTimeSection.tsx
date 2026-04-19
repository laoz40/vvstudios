import { useStore } from "@tanstack/react-store";
import { Calendar } from "#/components/ui/calendar";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import {
	toFieldErrorObjects,
	type AvailableTimeSection,
	type BookingFormValues,
} from "#/features/booking-form/lib/form-shared";
import {
	formatDateValue,
	formatMonthName,
	formatTimeValue,
	parseDateValue,
	startOfMonth,
	toOptionId,
} from "#/lib/bookingdatetime";

export interface BookingDateTimeSectionProps {
	availabilityError: string;
	availableTimeSections: AvailableTimeSection[];
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
	availableTimeSections,
	calendarMonth,
	disabledDates,
	isLoadingMonthAvailability,
	isSelectedDateInPast,
	isViewingSelectedMonth,
	selectedDate,
	setCalendarMonth,
}: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const formValues = useStore(formApi.store, (state) => state.values as BookingFormValues);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const hasAvailableTimes = availableTimeSections.some((section) => section.times.length > 0);
	const selectedMonthName = formValues.date
		? formatMonthName(parseDateValue(formValues.date) ?? new Date())
		: undefined;

	return (
		<div className="grid gap-6 xl:grid-cols-[max-content_minmax(0,1fr)] xl:items-start">
			<formApi.Field name="date">
				{(field) => (
					<Field data-field-name="date">
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
					<FieldSet
						data-field-name="time"
						className="min-w-0">
						<FieldLegend>Time *</FieldLegend>
						<RadioGroup
							value={field.state.value}
							onValueChange={(value) => {
								field.handleChange(value as BookingFormValues["time"]);
								field.handleBlur();
							}}
							disabled={
								!formValues.date ||
								!isViewingSelectedMonth ||
								isLoadingMonthAvailability ||
								!hasAvailableTimes
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
													<FieldTitle>{formatTimeValue(time)}</FieldTitle>
												</Field>
											</FieldLabel>
										))}
									</div>
								</div>
							))}
						</RadioGroup>
						{!formValues.date || !isViewingSelectedMonth ? (
							<FieldDescription>Select a date to view times.</FieldDescription>
						) : null}
						{formValues.date && isViewingSelectedMonth && isSelectedDateInPast ? (
							<FieldDescription>Past dates are unavailable.</FieldDescription>
						) : null}
						{selectedMonthName && isViewingSelectedMonth && isLoadingMonthAvailability ? (
							<FieldDescription>Loading times for {selectedMonthName}...</FieldDescription>
						) : null}
						{!isLoadingMonthAvailability &&
						formValues.date &&
						isViewingSelectedMonth &&
						!isSelectedDateInPast &&
						!hasAvailableTimes &&
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
	);
}
