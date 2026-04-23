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
	const [activeTimeSectionKey, setActiveTimeSectionKey] = useState<string | null>(null);
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
	const firstAvailableTimeSection = availableTimeSections.find((section) => section.times.length > 0);
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
		<div className="grid max-w-6xl gap-6 xl:grid-cols-5 xl:items-start xl:gap-8">
			<div className="xl:col-span-2">
				<formApi.Field name="date">
					{(field) => (
						<Field
							data-field-name="date"
							className="gap-3">
							<FieldLabel className="text-sm! font-semibold tracking-widest text-primary uppercase">
								{sectionCopy.dateLabel}
							</FieldLabel>
							<div className="bg-input/30 border-border overflow-hidden rounded-lg border">
								<Calendar
									className="w-full bg-transparent p-5 [--cell-size:--spacing(11)]"
									classNames={{
										root: "w-full",
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

			<div className="xl:col-span-3 xl:max-w-4xl">
				<formApi.Field name="time">
					{(field) => (
						<FieldSet
							data-field-name="time"
							className="min-w-0 gap-3">
							<FieldLegend className="text-sm! font-semibold tracking-widest text-primary uppercase">
								{sectionCopy.timeLabel}
							</FieldLegend>
							{availableTimeSections.length > 0 ? (
								<div className="flex flex-wrap gap-3">
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
														"bg-input/30 border-border rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
													"disabled:cursor-not-allowed disabled:opacity-50",
													isActive
														? "border-primary bg-primary/10 text-foreground"
														: "text-foreground/80 hover:border-primary hover:bg-primary/10",
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
										<p className="text-sm font-medium text-foreground/80">
											{activeTimeSection.label}
										</p>
											<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
											{activeTimeSection.times.map((time) => (
												<FieldLabel
													key={time}
													className="bg-input/30 border-border w-full! cursor-pointer flex-row! rounded-lg border transition-colors hover:border-primary hover:bg-primary/10">
													<Field
														orientation="horizontal"
															className={cn(
																"h-14 w-full items-center justify-start rounded-lg px-3.5 py-2",
																"gap-2.5",
															)}>
														<RadioGroupItem
															value={time}
															id={`time-${toOptionId(time)}`}
														/>
														<FieldTitle className="whitespace-nowrap text-sm">
															{formatTimeValue(time)}
														</FieldTitle>
													</Field>
												</FieldLabel>
											))}
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
	);
}
