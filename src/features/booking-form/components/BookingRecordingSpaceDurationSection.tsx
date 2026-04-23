import { Image } from "@unpic/react";
import { useStore } from "@tanstack/react-store";
import { Check, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import armchairSetupImage from "#/assets/armchair-setup.webp";
import tableSetupImage from "#/assets/gallery/table-setup.webp";
import { Button } from "#/components/ui/button";
import { FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { env } from "#/env";
import {
	toFieldErrorObjects,
	type BookingFormValues,
} from "#/features/booking-form/lib/form-shared";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toOptionId } from "#/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionCopy = {
	recordingSpaceLabel: "SELECT RECORDING SPACE",
	durationLabel: "SELECT SESSION DURATION",
	recurringPromptPrefix: "Need recurring sessions?",
	recurringPromptAction: "Request a call",
	recurringPromptSuffix: "to lock in your slot and secure a discounted rate.",
	requestCallDialogTitle: "Request a call",
	requestCallDialogClose: "Close",
} as const;

type DurationOption = {
	value: BookingFormValues["duration"];
	label: string;
	originalPrice: string;
	discountedPrice: string;
	badgeLabel?: string;
};

const recordingSpaceOptions = [
	{
		value: "Table Setup" as const,
		title: "Table Setup",
		description: "For your serious discussions",
		image: tableSetupImage,
		imageAlt: "Podcast table setup with microphones and studio lighting",
	},
	{
		value: "Open Setup" as const,
		title: "Open Setup",
		description: "For a more relaxed atmosphere",
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

const pressableClass =
	"transform-gpu transition-[transform,border-color,background-color,color] duration-500 ease-in";

export function BookingRecordingSpaceDurationSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const [isRequestCallOpen, setIsRequestCallOpen] = useState(false);

	return (
		<>
			<formApi.Field name="service">
				{(field) => (
					<section
						data-field-name="service"
						className="scroll-mt-32 space-y-1 sm:scroll-mt-40">
						<FieldSet className="gap-1">
							<FieldLegend className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
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
												"border-border peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background group block cursor-pointer overflow-hidden rounded-lg border transition duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 hover:border-primary",
												pressableClass,
												field.state.value === option.value && "border-primary",
											)}>
											<div className="relative h-56 w-full">
												{field.state.value === option.value ? (
													<span className="bg-primary text-primary-foreground absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full shadow-lg">
														<Check className="size-4" />
													</span>
												) : null}
												<Image
													src={option.image}
													alt={option.imageAlt}
													layout="constrained"
													width={720}
													height={448}
													className="h-full w-full object-cover"
												/>
											</div>
											<div
												className={cn(
													"bg-input/30 px-4 py-2 transition duration-300 group-hover:bg-primary/10",
													field.state.value === option.value && "bg-primary/10",
												)}>
												<p className="text-base font-semibold">{option.title}</p>
												<p className="text-sm font-light text-muted-foreground">
													{option.description}
												</p>
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
							<FieldLegend className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
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
													"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background relative flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border px-4 py-2 transition duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
													pressableClass,
													field.state.value === option.value && "border-primary bg-primary/10",
												)}>
												{option.badgeLabel ? (
													<span className="bg-primary text-primary-foreground absolute -top-2 -right-2 rounded-sm px-2 py-0.5 text-[10px] font-semibold shadow-lg">
														{option.badgeLabel}
													</span>
												) : null}
												<p className="text-base font-semibold">{option.label}</p>
												<div className="relative flex items-center justify-center gap-1 text-sm">
													{hasDiscount ? (
														<>
															<p className="whitespace-nowrap text-primary">
																{option.discountedPrice}
															</p>
															<p className="text-muted-foreground whitespace-nowrap line-through">
																{option.originalPrice}
															</p>
														</>
													) : (
														<p className="whitespace-nowrap text-primary">
															{option.discountedPrice}
														</p>
													)}
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

			<div className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">
					{sectionCopy.recurringPromptPrefix}{" "}
					<Dialog.Root
						open={isRequestCallOpen}
						onOpenChange={setIsRequestCallOpen}>
						<Dialog.Trigger asChild>
							<Button
								type="button"
								variant="link"
								className="accent-link text-foreground p-0 font-medium">
								{sectionCopy.recurringPromptAction}
							</Button>
						</Dialog.Trigger>
						<Dialog.Portal>
							<Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
							<Dialog.Content className="bg-popover fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl px-3 py-3 shadow-2xl outline-none sm:w-[calc(100%-2rem)] sm:px-4 sm:py-4">
								<div className="flex items-center justify-between gap-3">
									<Dialog.Title className="text-lg font-semibold text-white">
										{sectionCopy.requestCallDialogTitle}
									</Dialog.Title>
									<Dialog.Close asChild>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label={sectionCopy.requestCallDialogClose}>
											<X />
										</Button>
									</Dialog.Close>
								</div>
								<div className="overflow-hidden rounded-xl bg-white p-1">
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
				</p>
			</div>
		</>
	);
}
