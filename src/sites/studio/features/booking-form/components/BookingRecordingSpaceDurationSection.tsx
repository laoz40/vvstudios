import { useSelector } from "@tanstack/react-store";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { RecordingSpaceField } from "#studio/features/booking-form/components/RecordingSpaceField";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getCardStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import {
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	DURATION_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionCopy = {
	recordingSpaceLabel: "RECORDING SPACE",
	durationLabel: "SESSION DURATION *",
	recordingSpaceNote:
		"Each session includes three Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting."
} as const;

type DurationOption = {
	value: BookingFormValues["duration"];
	label: string;
	originalPrice: string;
	discountedPrice: string;
	priceNote?: string;
	badgeLabel?: string;
};

const durationOptions: DurationOption[] = [
	{
		value: "1h" as const,
		label: "1 Hour",
		originalPrice: "$200",
		discountedPrice: formatBookingPrice(DURATION_PRICES["1h"]),
		priceNote: "Standard rate"
	},
	{
		value: "2h" as const,
		label: "2 Hours",
		originalPrice: "$400",
		discountedPrice: formatBookingPrice(DURATION_PRICES["2h"]),
		badgeLabel: "MOST POPULAR"
	},
	{
		value: "3h" as const,
		label: "3 Hours",
		originalPrice: "$600",
		discountedPrice: formatBookingPrice(DURATION_PRICES["3h"])
	}
] as const;

export function BookingRecordingSpaceDurationSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const isPackageBooking = useSelector(
		formApi.store,
		(state) => state.values.bookingMode === "multi"
	);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
			<formApi.Field name="duration">
				{(field) => (
					<section
						data-field-name="duration"
						className="scroll-mt-32 space-y-1 sm:scroll-mt-40">
						<FieldSet className="gap-1">
							<FieldLegend className={sectionHeadingClassName}>
								{sectionCopy.durationLabel}
							</FieldLegend>
							<RadioGroup
								value={field.state.value}
								onValueChange={(value) => {
									field.handleChange(value as BookingFormValues["duration"]);
									field.handleBlur();
								}}
								className="grid gap-4 sm:grid-cols-3">
								{durationOptions.map((option) => {
									const isSelected = field.state.value === option.value;
									const hasDiscount = option.originalPrice !== option.discountedPrice;

									return (
										<div key={option.value}>
											<RadioGroupItem
												value={option.value}
												id={`duration-${toOptionId(option.value)}`}
												className="peer sr-only size-0"
											/>
											<label
												htmlFor={`duration-${toOptionId(option.value)}`}
												className={cn(
													"pressable relative flex cursor-pointer items-center justify-between rounded-lg border bg-input/30",
													"gap-3 p-4 shadow-lg shadow-background/25",
													"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
													"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
													transitionClassName,
													getCardStateClassName(isSelected),
													isSelected && "shadow-primary/20"
												)}>
												{option.badgeLabel ? (
													<span
														className={cn(
															"absolute -top-2 -right-2 rounded-full",
															"px-3 py-1",
															"text-[10px] leading-none font-semibold",
															"bg-primary text-primary-foreground"
														)}>
														{option.badgeLabel}
													</span>
												) : null}
												<div>
													<p className="text-lg font-semibold text-foreground">{option.label}</p>
													<div className="flex items-baseline gap-1.5 whitespace-nowrap">
														<p className="text-sm font-semibold text-primary">
															{option.discountedPrice}
														</p>
														{hasDiscount ? (
															<p className="text-sm font-light text-muted-foreground line-through">
																{option.originalPrice}
															</p>
														) : null}
													</div>
												</div>
												{isSelected ? (
													<span
														className={cn(
															"inline-flex items-center justify-center rounded-lg border px-2.5 py-0.5 md:min-h-8 md:px-3 md:py-1",
															"text-xs font-medium tracking-wider shadow-md",
															getPillStateClassName(true)
														)}>
														SELECTED
													</span>
												) : null}
											</label>
										</div>
									);
								})}
							</RadioGroup>
							{field.state.meta.isBlurred || shouldShowFieldError ? (
								<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
							) : null}
						</FieldSet>
					</section>
				)}
			</formApi.Field>

			<formApi.Field name="service">
				{(field) => (
					<RecordingSpaceField
						disabled={isPackageBooking}
						idPrefix="service"
						label={`${sectionCopy.recordingSpaceLabel}${isPackageBooking ? "" : " *"}`}
						value={field.state.value}
						onChange={(value) => {
							field.handleChange(value);
							field.handleBlur();
						}}>
						<FieldDescription className="mt-2! text-pretty italic">
							{isPackageBooking
								? "Recording space is selected when you schedule your sessions."
								: sectionCopy.recordingSpaceNote}
						</FieldDescription>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</RecordingSpaceField>
				)}
			</formApi.Field>
		</>
	);
}
