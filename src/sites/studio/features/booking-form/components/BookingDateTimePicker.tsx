import { LoaderCircle } from "lucide-react";
import { Calendar } from "#/components/ui/calendar";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Separator } from "#/components/ui/separator";
import {
	getCardStateClassName,
	getTextStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import type { BookingTimeSelectionMessage } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAvailabilityPickerState } from "#studio/features/booking-form/hooks/useBookingAvailability";
import {
	formatDateValue,
	formatTimeValue,
	getTimeValueMinutes,
	startOfMonth,
	toOptionId,
	type BusyPeriod
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const copy = {
	dateLabel: "Session Date *",
	timeLabel: "Session Time *",
	pastDatesUnavailable: "Past dates are unavailable.",
	loadingAvailability: "Loading availability...",
	noTimesAvailable: "No times available for this date."
} as const;

export interface BookingDateTimePickerProps {
	availability: BookingAvailabilityPickerState;
	dateError?: React.ReactNode;
	disabled?: boolean;
	onDateChange: (dateValue: string) => void;
	onTimeChange: (time: string) => void;
	selectedTime: string;
	timeError?: React.ReactNode;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
}

export function BookingDateTimePicker({
	availability,
	dateError,
	disabled = false,
	onDateChange,
	onTimeChange,
	selectedTime,
	timeError,
	timeSelectionMessage
}: BookingDateTimePickerProps) {
	const {
		availabilityError,
		availableTimes,
		calendarMonth,
		disabledDates,
		isLoadingMonthAvailability,
		selectedBusyPeriods,
		unavailableDates,
		isSelectedDateInPast,
		isViewingSelectedMonth,
		selectedDate,
		setCalendarMonth
	} = availability;
	return (
		<div className="grid max-w-7xl gap-6 xl:grid-cols-3 xl:items-start xl:gap-4">
			<div className="xl:col-span-2">
				<Field
					data-field-name="date"
					className="gap-3">
					<FieldLabel className={sectionHeadingClassName}>{copy.dateLabel}</FieldLabel>
					<div
						className={cn(
							"flex overflow-hidden xl:h-128",
							"rounded-lg border border-border bg-card",
							"shadow-lg shadow-background/25"
						)}>
						<Calendar
							className={cn(
								"h-full",
								"p-5 xl:p-6",
								"bg-transparent",
								"[--cell-size:--spacing(12)] xl:[--cell-size:--spacing(16)]"
							)}
							classNames={{
								months: "relative flex h-full w-full flex-col gap-4 md:flex-row",
								month: "flex h-full w-full min-w-0 flex-col gap-3",
								nav: "absolute inset-x-5 top-0 flex items-center justify-between gap-1",
								button_previous: cn(
									"inline-flex size-10 items-center justify-center rounded-md p-0",
									"text-sm font-medium",
									"select-none outline-none",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
									"focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"aria-disabled:opacity-50"
								),
								button_next: cn(
									"inline-flex size-10 items-center justify-center rounded-md p-0",
									"text-sm font-medium",
									"select-none outline-none",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
									"focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"aria-disabled:opacity-50"
								),
								month_caption: "flex h-10 w-full items-center justify-center px-10",
								caption_label: cn(
									"font-medium",
									"select-none outline-none",
									"focus-visible:ring-2 focus-visible:ring-primary",
									"focus-visible:ring-offset-2 focus-visible:ring-offset-background"
								),
								table: "w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1",
								day: "aspect-auto p-0.5 md:p-1",
								day_button: cn(
									"h-11 py-0 md:h-12 xl:h-14 xl:text-lg!",
									"data-[selected-single=true]:!bg-primary",
									"data-[selected-single=true]:!text-primary-foreground"
								)
							}}
							mode="single"
							required
							modifiers={{ unavailable: unavailableDates }}
							modifiersClassNames={{
								unavailable: cn(
									"!opacity-100",
									"[&_button]:!bg-surface-subtle [&_button]:!text-muted-foreground",
									"[&_button]:!shadow-none"
								)
							}}
							disabled={
								disabled ? () => true : (date) => disabledDates(date) || unavailableDates(date)
							}
							disableNavigation={disabled}
							month={calendarMonth}
							onMonthChange={disabled ? undefined : setCalendarMonth}
							selected={selectedDate}
							onSelect={(date) => {
								setCalendarMonth(startOfMonth(date));
								onDateChange(formatDateValue(date));
							}}
						/>
					</div>
					{dateError}
				</Field>
			</div>

			<TimeSelectionField
				availabilityError={availabilityError}
				availableTimes={availableTimes}
				disabled={disabled}
				isLoadingMonthAvailability={isLoadingMonthAvailability}
				selectedBusyPeriods={selectedBusyPeriods}
				isSelectedDateInPast={isSelectedDateInPast}
				isViewingSelectedMonth={isViewingSelectedMonth}
				onTimeChange={onTimeChange}
				selectedTime={selectedTime}
				timeError={timeError}
				timeSelectionMessage={timeSelectionMessage}
			/>
		</div>
	);
}

interface TimeSelectionFieldProps {
	availabilityError: string | null;
	availableTimes: string[];
	disabled: boolean;
	isLoadingMonthAvailability: boolean;
	selectedBusyPeriods: BookingAvailabilityPickerState["selectedBusyPeriods"];
	isSelectedDateInPast: boolean;
	isViewingSelectedMonth: boolean;
	onTimeChange: (time: string) => void;
	selectedTime: string;
	timeError?: React.ReactNode;
	timeSelectionMessage: BookingTimeSelectionMessage | null;
}

function TimeSelectionField({
	availabilityError,
	availableTimes,
	disabled,
	isLoadingMonthAvailability,
	selectedBusyPeriods,
	isSelectedDateInPast,
	isViewingSelectedMonth,
	onTimeChange,
	selectedTime,
	timeError,
	timeSelectionMessage
}: TimeSelectionFieldProps) {
	const hasAvailableTimes = availableTimes.length > 0;
	const timeSelectionItems: TimeSelectionItem[] = [
		...availableTimes.map((time) => ({ kind: "available" as const, time })),
		...selectedBusyPeriods.map((period) => ({ kind: "unavailable" as const, period }))
	].toSorted((left, right) => {
		const leftStart = left.kind === "available" ? left.time : left.period.start;
		const rightStart = right.kind === "available" ? right.time : right.period.start;
		return getTimeValueMinutes(leftStart) - getTimeValueMinutes(rightStart);
	});
	const isTimeSelectionReady = !timeSelectionMessage;
	const isTimePickerDisabled =
		disabled || !isTimeSelectionReady || !isViewingSelectedMonth || isLoadingMonthAvailability;

	return (
		<div className="flex h-full min-w-0 flex-col xl:max-w-sm">
			<FieldSet
				data-field-name="time"
				className="min-w-0 gap-3">
				<FieldLegend className={sectionHeadingClassName}>{copy.timeLabel}</FieldLegend>
				<TimeSelectionStatus
					availabilityError={availabilityError}
					hasAvailableTimes={hasAvailableTimes}
					isLoadingMonthAvailability={isLoadingMonthAvailability}
					isSelectedDateInPast={isSelectedDateInPast}
					isViewingSelectedMonth={isViewingSelectedMonth}
					timeSelectionMessage={timeSelectionMessage}
				/>
				{hasAvailableTimes ? (
					<div
						data-lenis-prevent
						className={cn(
							"-m-1 -mr-2 max-h-76 overflow-y-auto overscroll-contain p-1 pr-2",
							"outline-none focus-visible:ring-2 focus-visible:ring-primary",
							"focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"xl:h-128 xl:max-h-none xl:-mr-3 xl:pr-3"
						)}>
						<RadioGroup
							value={selectedTime}
							onValueChange={onTimeChange}
							disabled={isTimePickerDisabled}
							className="flex flex-col gap-6">
							<div className="grid grid-cols-1 gap-3">
								{timeSelectionItems.map((item) => (
									<TimeSelectionListItem
										key={
											item.kind === "available"
												? item.time
												: `${item.period.start}-${item.period.end}`
										}
										item={item}
										selectedTime={selectedTime}
									/>
								))}
							</div>
						</RadioGroup>
					</div>
				) : null}
				{availabilityError ? (
					<FieldDescription className="text-destructive">{availabilityError}</FieldDescription>
				) : null}
				{timeError}
			</FieldSet>
		</div>
	);
}

function TimeSelectionStatus({
	availabilityError,
	hasAvailableTimes,
	isLoadingMonthAvailability,
	isSelectedDateInPast,
	isViewingSelectedMonth,
	timeSelectionMessage
}: Pick<
	TimeSelectionFieldProps,
	| "availabilityError"
	| "isLoadingMonthAvailability"
	| "isSelectedDateInPast"
	| "isViewingSelectedMonth"
	| "timeSelectionMessage"
> & { hasAvailableTimes: boolean }) {
	if (timeSelectionMessage) {
		return (
			<FieldDescription
				className={cn(timeSelectionMessage.variant === "error" && "text-destructive")}>
				{timeSelectionMessage.text}
			</FieldDescription>
		);
	}

	return (
		<>
			{isViewingSelectedMonth && isSelectedDateInPast ? (
				<FieldDescription>{copy.pastDatesUnavailable}</FieldDescription>
			) : null}
			{isViewingSelectedMonth && isLoadingMonthAvailability ? (
				<FieldDescription className="flex items-center gap-2">
					<LoaderCircle className="size-4 animate-spin" />
					{copy.loadingAvailability}
				</FieldDescription>
			) : null}
			<NoAvailableTimesMessage
				availabilityError={availabilityError}
				hasAvailableTimes={hasAvailableTimes}
				isLoadingMonthAvailability={isLoadingMonthAvailability}
				isSelectedDateInPast={isSelectedDateInPast}
				isViewingSelectedMonth={isViewingSelectedMonth}
			/>
		</>
	);
}

function NoAvailableTimesMessage({
	availabilityError,
	hasAvailableTimes,
	isLoadingMonthAvailability,
	isSelectedDateInPast,
	isViewingSelectedMonth
}: Omit<
	TimeSelectionFieldProps,
	| "disabled"
	| "selectedBusyPeriods"
	| "selectedDate"
	| "onTimeChange"
	| "selectedTime"
	| "timeError"
	| "timeSelectionMessage"
	| "availableTimes"
> & { hasAvailableTimes: boolean }) {
	if (
		isLoadingMonthAvailability ||
		!isViewingSelectedMonth ||
		isSelectedDateInPast ||
		hasAvailableTimes ||
		availabilityError
	) {
		return null;
	}

	return <FieldDescription>{copy.noTimesAvailable}</FieldDescription>;
}

type TimeSelectionItem =
	| { kind: "available"; time: string }
	| { kind: "unavailable"; period: BusyPeriod };

function TimeSelectionListItem({
	item,
	selectedTime
}: {
	item: TimeSelectionItem;
	selectedTime: string;
}) {
	switch (item.kind) {
		case "available":
			return (
				<TimeOption
					isSelected={selectedTime === item.time}
					time={item.time}
				/>
			);
		case "unavailable":
			return (
				<div
					aria-disabled="true"
					className="flex items-center gap-2 py-1 text-xs font-normal text-muted-foreground">
					<Separator className="flex-1" />
					<span className="whitespace-nowrap">
						{formatTimeValue(item.period.start)} – {formatTimeValue(item.period.end)} · Booked
					</span>
					<Separator className="flex-1" />
				</div>
			);
		default: {
			const _exhaustive: never = item;
			return _exhaustive;
		}
	}
}

function TimeOption({ isSelected, time }: { isSelected: boolean; time: string }) {
	const timeOptionId = `time-${toOptionId(time)}`;

	return (
		<div className="relative rounded-lg">
			<RadioGroupItem
				value={time}
				id={timeOptionId}
				className="peer sr-only size-0"
			/>
			<FieldLabel
				htmlFor={timeOptionId}
				className={cn(
					"pressable w-full! flex-row! cursor-pointer rounded-lg border border-border bg-card",
					"shadow-lg shadow-background/25",
					"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary",
					"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
					transitionClassName,
					getCardStateClassName(isSelected),
					isSelected && "shadow-primary/20"
				)}>
				<Field
					orientation="horizontal"
					className={cn(
						"relative h-14 w-full items-center justify-center",
						"rounded-lg px-3.5 py-2"
					)}>
					<FieldTitle
						className={cn(
							"w-full justify-center text-center",
							"whitespace-nowrap text-base font-semibold text-card-foreground",
							getTextStateClassName(isSelected)
						)}>
						{formatTimeValue(time)}
					</FieldTitle>
				</Field>
			</FieldLabel>
		</div>
	);
}
