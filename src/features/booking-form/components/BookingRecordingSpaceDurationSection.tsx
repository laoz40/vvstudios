import { useState } from "react";
import { Image } from "@unpic/react";
import { useStore } from "@tanstack/react-store";
import armchairSetupImage from "#/assets/gallery/armchair-setup.jpg";
import tableSetupImage from "#/assets/gallery/table-setup.jpg";
import { Button } from "#/components/ui/button";
import { FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { env } from "#/env";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import {
	getCardStateClassName,
	getFooterStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName,
} from "#/features/booking-form/lib/booking-form-styles";
import {
	toFieldErrorObjects,
	type BookingFormValues,
} from "#/features/booking-form/lib/form-shared";
import { toOptionId } from "#/lib/bookingdatetime";
import { cn } from "#/lib/utils";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";

const sectionCopy = {
	recordingSpaceLabel: "RECORDING SPACE *",
	durationLabel: "SESSION DURATION *",
	recurringPromptPrefix: "Need recurring sessions?",
	recurringPromptAction: "Request a call",
	recurringPromptSuffix: "to lock in your slot at a discounted rate.",
	requestCallDialogTitle: "Request a call",
	requestCallDialogDescription: "Book a quick call to discuss recurring sessions and availability.",
	requestCallDialogClose: "Close",
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
		image: tableSetupImage,
		imageAlt: "Podcast table setup with microphones and studio lighting",
	},
	{
		value: "Armchair Setup" as const,
		title: "Armchair Setup",
		image: armchairSetupImage,
		imageAlt: "Podcast open setup with warm lamps and casual seating",
	},
] as const;

const durationOptions: DurationOption[] = [
	{
		value: "1h" as const,
		label: "1 Hour",
		originalPrice: "$200",
		discountedPrice: "$200",
		priceNote: "Standard rate",
	},
	{
		value: "2h" as const,
		label: "2 Hours",
		originalPrice: "$400",
		discountedPrice: "$299",
		badgeLabel: "MOST POPULAR",
	},
	{
		value: "3h" as const,
		label: "3 Hours",
		originalPrice: "$600",
		discountedPrice: "$399",
	},
] as const;

export function BookingRecordingSpaceDurationSection() {
	const formApi = useBookingFormContext();
	const [isRequestCallOpen, setIsRequestCallOpen] = useState(false);
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
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
												"pressable border-border peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background group relative block cursor-pointer overflow-hidden rounded-2xl border peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 md:hover:bg-primary/5",
												transitionClassName,
												getCardStateClassName(field.state.value === option.value),
												field.state.value === option.value && "md:bg-primary/5",
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
														field.state.value === option.value && "scale-[1.02]",
													)}
												/>
												<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/95 via-background/65 to-transparent md:hidden" />
											</div>
											<div
												className={cn(
													"pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 px-3 py-1 backdrop-blur-[3px] md:static md:px-3 md:py-1.5 md:group-hover:bg-primary/10",
													getFooterStateClassName(field.state.value === option.value),
													field.state.value === option.value && "md:bg-primary/10",
												)}>
												<p className="text-base font-semibold text-foreground">{option.title}</p>
												<span
													className={cn(
														"inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wider shadow-md md:min-h-8 md:px-3 md:py-1",
														getPillStateClassName(field.state.value === option.value),
														field.state.value === option.value &&
															"md:border-primary/40 md:bg-background/85 md:text-primary",
													)}>
													{field.state.value === option.value ? "SELECTED" : "SELECT"}
												</span>
											</div>
										</label>
									</div>
								))}
							</RadioGroup>
							{field.state.meta.isBlurred || shouldShowFieldError ? (
								<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
							) : null}
						</FieldSet>
					</section>
				)}
			</formApi.Field>

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
													"pressable border-border bg-input/30 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background relative flex cursor-pointer items-center justify-between rounded-lg border px-4 py-6 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
													transitionClassName,
													getCardStateClassName(field.state.value === option.value),
												)}>
												{option.badgeLabel ? (
													<span className="bg-primary text-primary-foreground absolute -top-2 -right-2 rounded-full px-3 py-1 text-[10px] font-semibold leading-none">
														{option.badgeLabel}
													</span>
												) : null}
												<p className="text-base font-semibold leading-none">{option.label}</p>
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
						<div className="mt-6 text-sm text-muted-foreground">
							{sectionCopy.recurringPromptPrefix}{" "}
							<Dialog.Root
								open={isRequestCallOpen}
								onOpenChange={setIsRequestCallOpen}>
								<Button
									type="button"
									variant="link"
									className="accent-link text-foreground p-0 font-medium"
									aria-haspopup="dialog"
									aria-expanded={isRequestCallOpen}
									onClick={() => {
										setIsRequestCallOpen(true);
									}}>
									{sectionCopy.recurringPromptAction}
								</Button>
								<Dialog.Portal>
									<Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
									<Dialog.Content className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 text-sm outline-none ring-1 max-h-[calc(100vh-2rem)] sm:w-[calc(100%-2rem)] sm:p-6">
										<div className="space-y-2 pr-10">
											<Dialog.Title className="text-xl font-semibold">
												{sectionCopy.requestCallDialogTitle}
											</Dialog.Title>
											<Dialog.Description className="text-muted-foreground text-sm leading-6">
												{sectionCopy.requestCallDialogDescription}
											</Dialog.Description>
										</div>

										<Dialog.Close asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="absolute top-2 right-2"
												aria-label={sectionCopy.requestCallDialogClose}>
												<X />
											</Button>
										</Dialog.Close>

										<div className="overflow-hidden rounded-xl border border-border bg-white">
											<iframe
												src={env.VITE_BOOKING_RECURRING_URL}
												title={sectionCopy.requestCallDialogTitle}
												className="block min-h-176 w-full border-0 bg-transparent"
											/>
										</div>
									</Dialog.Content>
								</Dialog.Portal>
							</Dialog.Root>{" "}
							{sectionCopy.recurringPromptSuffix}
						</div>
					</section>
				)}
			</formApi.Field>
		</>
	);
}
