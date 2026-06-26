import { Image } from "@unpic/react";
import { useSelector } from "@tanstack/react-store";
import armchairSetupImage from "#studio/assets/gallery/armchair-setup.webp";
import tableSetupImage from "#studio/assets/gallery/table-setup.webp";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getCardStateClassName,
	getFooterStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import {
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/form-shared";
import {
	DURATION_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionCopy = {
	recordingSpaceLabel: "RECORDING SPACE *",
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

const recordingSpaceOptions = [
	{
		value: "Table Setup" as const,
		title: "Table Setup",
		capacity: "up to 4 people",
		image: tableSetupImage,
		imageAlt: "Podcast table setup with microphones and studio lighting"
	},
	{
		value: "Armchair Setup" as const,
		title: "Armchair Setup",
		capacity: "up to 2 people",
		image: armchairSetupImage,
		imageAlt: "Podcast open setup with warm lamps and casual seating"
	}
] as const;

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
													"px-4 py-6",
													"shadow-lg shadow-background/25",
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
												<p className="relative inline-flex w-fit whitespace-nowrap text-base font-semibold leading-none">
													{option.label}
													{isSelected ? (
														<span
															className={cn(
																"absolute top-1/2 left-full ml-2 -translate-y-1/2",
																"inline-flex items-center justify-center rounded-lg border",
																"px-2.5 py-0.5",
																"text-xs font-medium tracking-wider",
																"shadow-md transition-all duration-200 ease-in sm:hidden",
																getPillStateClassName(true)
															)}>
															SELECTED
														</span>
													) : null}
												</p>
												<div className="flex items-end gap-1 whitespace-nowrap">
													{hasDiscount ? (
														<p className="text-muted-foreground text-xs line-through leading-none">
															{option.originalPrice}
														</p>
													) : null}
													<p className="text-primary text-base font-semibold leading-none">
														{option.discountedPrice}
													</p>
												</div>
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
					<section
						data-field-name="service"
						className="scroll-mt-32 space-y-1 sm:scroll-mt-40">
						<FieldSet className="gap-1">
							<FieldLegend className={sectionHeadingClassName}>
								{sectionCopy.recordingSpaceLabel}
							</FieldLegend>
							<RadioGroup
								value={field.state.value}
								onValueChange={(value) => {
									field.handleChange(value as BookingFormValues["service"]);
									field.handleBlur();
								}}
								className="grid gap-4 md:grid-cols-2">
								{recordingSpaceOptions.map((option) => (
									<div key={option.value}>
										<RadioGroupItem
											value={option.value}
											id={`service-${toOptionId(option.value)}`}
											className="peer sr-only size-0"
										/>
										<label
											htmlFor={`service-${toOptionId(option.value)}`}
											className={cn(
												"pressable group relative block cursor-pointer overflow-hidden rounded-lg border",
												"shadow-lg shadow-background/25",
												"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
												"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
												"md:hover:bg-primary/5",
												transitionClassName,
												getCardStateClassName(field.state.value === option.value),
												field.state.value === option.value && "md:bg-primary/5 shadow-primary/20"
											)}>
											<div className="relative w-full overflow-hidden">
												<Image
													src={option.image}
													alt={option.imageAlt}
													layout="constrained"
													width={1885}
													height={1060}
													className={cn(
														"h-auto w-full transition-transform duration-300 group-hover:scale-105",
														field.state.value === option.value && "scale-[1.02]"
													)}
												/>
												<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/95 via-background/65 to-transparent md:hidden" />
											</div>
											<div
												className={cn(
													"pointer-events-none absolute inset-x-0 bottom-0 z-10",
													"flex items-center justify-between gap-2",
													"px-3 py-1 md:static md:px-3 md:py-1.5",
													"backdrop-blur-[3px] md:group-hover:bg-primary/10",
													getFooterStateClassName(field.state.value === option.value),
													field.state.value === option.value && "md:bg-primary/10"
												)}>
												<p className="text-base font-semibold text-foreground">
													{option.title}{" "}
													<span className="text-muted-foreground font-light">
														({option.capacity})
													</span>
												</p>
												<span
													className={cn(
														"inline-flex items-center justify-center rounded-lg border",
														"px-2.5 py-0.5 md:min-h-8 md:px-3 md:py-1",
														"text-xs font-medium tracking-wider",
														"shadow-md transition-all duration-200 ease-in",
														getPillStateClassName(field.state.value === option.value)
													)}>
													{field.state.value === option.value ? "SELECTED" : "SELECT"}
												</span>
											</div>
										</label>
									</div>
								))}
							</RadioGroup>
							<FieldDescription className="mt-2! text-pretty italic">
								{sectionCopy.recordingSpaceNote}
							</FieldDescription>
							{field.state.meta.isBlurred || shouldShowFieldError ? (
								<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
							) : null}
						</FieldSet>
					</section>
				)}
			</formApi.Field>
		</>
	);
}
