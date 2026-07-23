import { useSelector } from "@tanstack/react-store";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { cn } from "#/lib/utils";
import { BookingAddonCard } from "#studio/features/booking-form/components/BookingAddonCard";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	getRevealMotionProps,
	sectionHeadingClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import {
	ADDON_OPTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	isDeliverableCountOption,
	isPackageUnavailableAddon,
	toFieldErrorObjects,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";

type BookingAddonQuantityFieldProps = {
	fieldName: "clipsPackageQuantity" | "essentialEditQuantity";
	formApi: ReturnType<typeof useBookingFormContext>;
	label: string;
	description: string;
	shouldShowFieldError: boolean;
};

function BookingAddonQuantityField({
	fieldName,
	formApi,
	label,
	description,
	shouldShowFieldError
}: BookingAddonQuantityFieldProps) {
	const FormField = formApi.Field;
	const shouldReduceMotion = useReducedMotion();
	const revealMotionProps = getRevealMotionProps(shouldReduceMotion === true);
	return (
		<motion.div
			key={fieldName}
			{...revealMotionProps}
			className="overflow-hidden">
			<FormField name={fieldName}>
				{(quantityField) => (
					<Field
						data-field-name={fieldName}
						className="gap-3 pt-2">
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
								<FieldTitle className="text-base">{label}:</FieldTitle>
								<RadioGroup
									value={quantityField.state.value}
									onValueChange={(value) => {
										if (isDeliverableCountOption(value)) {
											quantityField.handleChange(value);
											quantityField.handleBlur();
										}
									}}
									className="flex flex-wrap gap-x-5 gap-y-3">
									{DELIVERABLE_COUNT_OPTIONS.map((count) => (
										<FieldLabel
											key={count}
											className={cn(
												"flex cursor-pointer items-center gap-2",
												"text-sm font-medium",
												"has-data-[state=checked]:bg-transparent",
												"dark:has-data-[state=checked]:bg-transparent"
											)}>
											<RadioGroupItem
												value={count}
												className={cn(
													"size-5",
													"data-[state=checked]:border-primary",
													"data-[state=checked]:bg-primary",
													"data-[state=checked]:text-primary-foreground"
												)}
											/>
											<span>{count}</span>
										</FieldLabel>
									))}
								</RadioGroup>
							</div>
							<FieldDescription className="italic">{description}</FieldDescription>
						</div>
						{quantityField.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(quantityField.state.meta.errors)} />
						) : null}
					</Field>
				)}
			</FormField>
		</motion.div>
	);
}

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();
	const formValues = useSelector(formApi.store, (state) => state.values);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const isMultiBooking = formValues.bookingMode === "multi";
	const FormField = formApi.Field;

	return (
		<FormField name="addons">
			{(field) => {
				function handleAddonChange(addon: BookingAddon, checked: boolean) {
					let nextAddons = field.state.value.filter((value) => value !== addon);

					if (checked) {
						nextAddons = [...field.state.value, addon];
					}

					field.handleChange(nextAddons);
					field.handleBlur();

					// Clear each hidden editing add-on quantity when its add-on is removed,
					// so the form does not submit stale per-add-on quantities.
					if (!nextAddons.includes("Essential Edit")) {
						formApi.setFieldValue("essentialEditQuantity", "");
					}

					if (!nextAddons.includes("Clips Package")) {
						formApi.setFieldValue("clipsPackageQuantity", "");
					}
				}

				return (
					<FieldSet data-field-name="addons">
						<FieldLegend className={sectionHeadingClassName}>Add-ons</FieldLegend>
						<FieldDescription>Choose add-ons to enhance your session.</FieldDescription>
						<div className="flex flex-col gap-4">
							{ADDON_OPTIONS.map((addon) => (
								<div
									key={addon}
									className="space-y-3">
									<BookingAddonCard
										addon={addon}
										checked={field.state.value.includes(addon)}
										disabled={isMultiBooking && isPackageUnavailableAddon(addon)}
										onCheckedChange={handleAddonChange}
									/>
									<AnimatePresence initial={false}>
										{addon === "Essential Edit" && field.state.value.includes("Essential Edit") ? (
											<BookingAddonQuantityField
												key="essentialEditQuantity"
												formApi={formApi}
												fieldName="essentialEditQuantity"
												label={
													isMultiBooking
														? "Number of Essential Edits Per Session"
														: "Number of Essential Edits"
												}
												description={
													isMultiBooking
														? "Select how many episodes or projects you want edited for each session. Each Essential Edit adds $99."
														: "Charged per episode or project you want edited from this session."
												}
												shouldShowFieldError={shouldShowFieldError}
											/>
										) : null}
										{addon === "Clips Package" && field.state.value.includes("Clips Package") ? (
											<BookingAddonQuantityField
												key="clipsPackageQuantity"
												formApi={formApi}
												fieldName="clipsPackageQuantity"
												label={
													isMultiBooking
														? "Number of Clips Packages Per Session"
														: "Number of Clips Packages"
												}
												description={
													isMultiBooking
														? "Select how many clips packages you want for each session. Each 10-clip package adds $79."
														: "One package includes 10 edited social media clips. Charged per package."
												}
												shouldShowFieldError={shouldShowFieldError}
											/>
										) : null}
									</AnimatePresence>
								</div>
							))}
						</div>
					</FieldSet>
				);
			}}
		</FormField>
	);
}
