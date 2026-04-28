import { useEffect, useState } from "react";
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
	getCardStateClassName,
	getTextStateClassName,
	sectionHeadingClassName,
	transitionClassName,
} from "#/features/booking-form/lib/booking-form-styles";
import {
	toFieldErrorObjects,
	type AvailableTimeSection,
	type BookingFormValues,
	type TimeSectionKey,
} from "#/features/booking-form/lib/form-shared";
import {
	formatDateValue,
	formatMonthName,
	formatTimeValue,
	parseDateValue,
	startOfMonth,
	toOptionId,
} from "#/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionCopy = {
	dateLabel: "SESSION DATE *",
	timeLabel: "SESSION TIME *",
	timePeriodLabel: "Time of day",
	selectDatePrompt: "Select a date to view times.",
	pastDatesUnavailable: "Past dates are unavailable.",
	loadingTimesPrefix: "Loading times for",
	noTimesAvailable: "No times available for this date.",
} as const;

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
	const [activeTimeSectionKey, setActiveTimeSectionKey] = useState<TimeSectionKey | null>(null);
	const formValues = useStore(formApi.store, (state) => state.values as BookingFormValues);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const hasAvailableTimes = availableTimeSections.some((section) => section.times.length > 0);
	const selectedMonthName = formValues.date
		? formatMonthName(parseDateValue(formValues.date) ?? new Date())
		: undefined;
	const selectedTimeSection = availableTimeSections.find((section) =>
		section.times.includes(formValues.time),
	);
	const firstAvailableTimeSection = availableTimeSections.find(
		(section) => section.times.length > 0,
	);
	const activeTimeSection =
		availableTimeSections.find((section) => section.key === activeTimeSectionKey) ??
		selectedTimeSection ??
		firstAvailableTimeSection ??
		availableTimeSections[0];

	useEffect(() => {
		setActiveTimeSectionKey((currentKey) => {
			if (
				currentKey &&
				availableTimeSections.some(
					(section) => section.key === currentKey && section.times.length > 0,
				)
			) {
				return currentKey;
			}

			return selectedTimeSection?.key ?? firstAvailableTimeSection?.key ?? null;
		});
	}, [availableTimeSections, firstAvailableTimeSection, selectedTimeSection]);

	return (
		<section className="flex flex-col mt-0 gap-6 md:gap-8">
			<div className="grid max-w-6xl gap-6 xl:grid-cols-5 xl:items-start xl:gap-12">
				<div className="xl:col-span-2">
					<formApi.Field name="date">
						{(field) => (
							<Field
								data-field-name="date"
								className="gap-3">
								<FieldLabel className={sectionHeadingClassName}>{sectionCopy.dateLabel}</FieldLabel>
								<div className="bg-input/30 border-border overflow-hidden rounded-lg border">
									<Calendar
										className="bg-transparent p-5 [--cell-size:--spacing(12)]"
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
				</div>

				<div className="flex h-full flex-col xl:col-span-3 xl:max-w-4xl">
					<formApi.Field name="time">
						{(field) => (
							<FieldSet
								data-field-name="time"
								className="min-w-0 gap-3">
								<FieldLegend className={sectionHeadingClassName}>
									{sectionCopy.timeLabel}
								</FieldLegend>
								{availableTimeSections.length > 0 ? (
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
										<p className="sr-only">{sectionCopy.timePeriodLabel}</p>
										{availableTimeSections.map((section) => {
											const isActive = activeTimeSection?.key === section.key;
											const isDisabled = section.times.length === 0;

											return (
												<button
													key={section.key}
													type="button"
													onClick={() => {
														setActiveTimeSectionKey(section.key);
														if (!section.times.includes(formValues.time)) {
															field.handleChange("" as BookingFormValues["time"]);
														}
													}}
													disabled={isDisabled}
													className={cn(
														"pressable border-border bg-input/30 h-10 w-full rounded-md border px-4 py-2 text-sm! font-medium outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
														transitionClassName,
														"disabled:cursor-not-allowed disabled:opacity-50",
														getCardStateClassName(isActive),
														getTextStateClassName(isActive),
													)}>
													{section.label}
												</button>
											);
										})}
									</div>
								) : null}
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
									className="flex flex-col gap-6">
									{activeTimeSection ? (
										<div className="flex flex-col gap-4">
											<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
												{activeTimeSection.times.map((time) => {
													const isSelected = field.state.value === time;
													const timeOptionId = `time-${toOptionId(time)}`;

													return (
														<div key={time}>
															<RadioGroupItem
																value={time}
																id={timeOptionId}
																className="peer sr-only size-0"
															/>
															<FieldLabel
																htmlFor={timeOptionId}
																className={cn(
																	"pressable border-border bg-input/30 peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background w-full! cursor-pointer flex-row! rounded-lg border",
																	transitionClassName,
																	getCardStateClassName(isSelected),
																)}>
																<Field
																	orientation="horizontal"
																	className="relative h-14 w-full items-center justify-center rounded-lg px-3.5 py-2">
																	<FieldTitle
																		className={cn(
																			"w-full justify-center whitespace-nowrap text-center text-sm",
																			getTextStateClassName(isSelected),
																		)}>
																		{formatTimeValue(time)}
																	</FieldTitle>
																</Field>
															</FieldLabel>
														</div>
													);
												})}
											</div>
										</div>
									) : null}
								</RadioGroup>
								{!formValues.date || !isViewingSelectedMonth ? (
									<FieldDescription>{sectionCopy.selectDatePrompt}</FieldDescription>
								) : null}
								{formValues.date && isViewingSelectedMonth && isSelectedDateInPast ? (
									<FieldDescription>{sectionCopy.pastDatesUnavailable}</FieldDescription>
								) : null}
								{selectedMonthName && isViewingSelectedMonth && isLoadingMonthAvailability ? (
									<FieldDescription>
										{sectionCopy.loadingTimesPrefix} {selectedMonthName}...
									</FieldDescription>
								) : null}
								{!isLoadingMonthAvailability &&
								formValues.date &&
								isViewingSelectedMonth &&
								!isSelectedDateInPast &&
								!hasAvailableTimes &&
								!availabilityError ? (
									<FieldDescription>{sectionCopy.noTimesAvailable}</FieldDescription>
								) : null}
								{availabilityError ? <FieldError>{availabilityError}</FieldError> : null}
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</FieldSet>
						)}
					</formApi.Field>
				</div>
			</div>
		</section>
	);
}
