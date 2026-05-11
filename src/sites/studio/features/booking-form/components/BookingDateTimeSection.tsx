import { useStore } from "@tanstack/react-store";
import { LoaderCircle } from "lucide-react";
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
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getCardStateClassName,
	getTextStateClassName,
	sectionHeadingClassName,
	transitionClassName,
} from "#studio/features/booking-form/lib/booking-form-styles";
import {
	toFieldErrorObjects,
	type AvailableTimeSection,
	type BookingFormValues,
	type TimeSectionKey,
} from "#studio/features/booking-form/lib/form-shared";
import {
	formatBookingDateSummary,
	formatBookingTimeRange,
	formatDateValue,
	formatTimeValue,
	startOfMonth,
	toOptionId,
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionCopy = {
	dateLabel: "SESSION DATE *",
	timeLabel: "SESSION TIME *",
	selectDatePrompt: "Select a date to view times.",
	pastDatesUnavailable: "Past dates are unavailable.",
	loadingAvailability: "Loading availability...",
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
	onPreferredTimeSectionChange?: (key: TimeSectionKey | null) => void;
	preferredTimeSectionKey?: TimeSectionKey | null;
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
	onPreferredTimeSectionChange,
	selectedDate,
	setCalendarMonth,
}: BookingDateTimeSectionProps) {
	const formApi = useBookingFormContext();
	const formValues = useStore(formApi.store, (state) => state.values as BookingFormValues);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const availableTimes = availableTimeSections.flatMap((section) => section.times);
	const hasAvailableTimes = availableTimes.length > 0;
	const bookingDateSummary = formValues.date
		? formatBookingDateSummary(formValues.date)
		: "No selected date";
	const bookingTimeSummary = formValues.time
		? formValues.duration
			? formatBookingTimeRange(formValues.time, formValues.duration)
			: "No selected duration"
		: "No selected time";

	return (
		<section className="flex flex-col mt-0 gap-6 md:gap-8">
			<div className="grid max-w-7xl gap-6 xl:grid-cols-3 xl:items-start xl:gap-4">
				<div className="xl:col-span-2">
					<formApi.Field name="date">
						{(field) => (
							<Field
								data-field-name="date"
								className="gap-3">
								<FieldLabel className={sectionHeadingClassName}>{sectionCopy.dateLabel}</FieldLabel>
								<div className="border-border flex overflow-hidden rounded-lg border bg-input/30 shadow-lg shadow-background/25 xl:h-128">
									<Calendar
										className="h-full bg-transparent p-5 xl:p-6 [--cell-size:--spacing(12)] xl:[--cell-size:--spacing(16)]"
										classNames={{
											months: "relative flex h-full w-full flex-col gap-4 md:flex-row",
											month: "flex h-full w-full min-w-0 flex-col gap-3",
											nav: "absolute inset-x-5 top-0 flex items-center justify-between gap-1",
											button_previous:
												"inline-flex size-10 items-center justify-center rounded-md p-0 text-sm font-medium select-none outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:opacity-50",
											button_next:
												"inline-flex size-10 items-center justify-center rounded-md p-0 text-sm font-medium select-none outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:opacity-50",
											month_caption: "flex h-10 w-full items-center justify-center px-10",
											caption_label:
												"font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
											table:
												"w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1",
											day: "aspect-auto p-0.5 md:p-1",
											day_button: "h-11 py-0 md:h-12 xl:h-14 xl:text-lg!",
										}}
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

				<div className="flex h-full min-w-0 flex-col xl:max-w-sm">
					<formApi.Field name="time">
						{(field) => (
							<FieldSet
								data-field-name="time"
								className="min-w-0 gap-3">
								<FieldLegend className={sectionHeadingClassName}>
									{sectionCopy.timeLabel}
								</FieldLegend>
								{!formValues.date || !isViewingSelectedMonth ? (
									<FieldDescription>{sectionCopy.selectDatePrompt}</FieldDescription>
								) : null}
								{formValues.date && isViewingSelectedMonth && isSelectedDateInPast ? (
									<FieldDescription>{sectionCopy.pastDatesUnavailable}</FieldDescription>
								) : null}
								{formValues.date && isViewingSelectedMonth && isLoadingMonthAvailability ? (
									<FieldDescription className="flex items-center gap-2">
										<LoaderCircle className="size-4 animate-spin" />
										{sectionCopy.loadingAvailability}
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
								{hasAvailableTimes ? (
									<div
										data-lenis-prevent
										className="-m-1 -mr-2 max-h-96 overflow-y-auto overscroll-contain p-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background xl:h-128 xl:max-h-none xl:-mr-3 xl:pr-3">
										<RadioGroup
											value={field.state.value}
											onValueChange={(value) => {
												field.handleChange(value as BookingFormValues["time"]);
												onPreferredTimeSectionChange?.(
													availableTimeSections.find((section) => section.times.includes(value))
														?.key ?? null,
												);
												field.handleBlur();
											}}
											disabled={
												!formValues.date || !isViewingSelectedMonth || isLoadingMonthAvailability
											}
											className="flex flex-col gap-6">
											<div className="grid grid-cols-1 gap-3">
												{availableTimes.map((time) => {
													const isSelected = field.state.value === time;
													const timeOptionId = `time-${toOptionId(time)}`;

													return (
														<div
															key={time}
															className="relative rounded-lg">
															<RadioGroupItem
																value={time}
																id={timeOptionId}
																className="peer sr-only size-0"
															/>
															<FieldLabel
																htmlFor={timeOptionId}
																className={cn(
																	"pressable border-border bg-input/30 w-full! cursor-pointer flex-row! rounded-lg border shadow-lg shadow-background/25 peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
																	transitionClassName,
																	getCardStateClassName(isSelected),
																	isSelected && "shadow-primary/20",
																)}>
																<Field
																	orientation="horizontal"
																	className="relative h-14 w-full items-center justify-center rounded-lg px-3.5 py-2">
																	<FieldTitle
																		className={cn(
																			"w-full justify-center whitespace-nowrap text-center text-base text-card-foreground font-semibold",
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
										</RadioGroup>
									</div>
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
			<div
				aria-live="polite"
				className="text-muted-foreground flex min-h-10 flex-col gap-1 text-sm sm:flex-row sm:gap-8">
				<p>
					Date: <span className="text-foreground font-medium">{bookingDateSummary}</span>
				</p>
				<p>
					Time: <span className="text-foreground font-medium">{bookingTimeSummary}</span>
				</p>
			</div>
		</section>
	);
}
