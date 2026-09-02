import { useEffect } from "react";
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
	openClipsPackageDeselectedModal,
	openClipsPackageRequirementModal
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getRevealMotionProps,
	sectionHeadingClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import {
	ADDON_OPTIONS,
	ADDON_SECTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	isAddonAvailableForService,
	isClipVolumePackEditAddon,
	isDeliverableCountOption,
	isPackageUnavailableAddon,
	resolveExclusiveAddonSelection,
	satisfiesClipVolumePackEditRequirement,
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
	const availableAddonOptions = ADDON_OPTIONS.filter((addon) =>
		isAddonAvailableForService(formValues.service, addon)
	);
	const FormField = formApi.Field;

	// Remove add-ons that become unavailable when the recording space changes.
	useEffect(() => {
		const availableAddons = formValues.addons.filter((addon) =>
			isAddonAvailableForService(formValues.service, addon)
		);

		if (availableAddons.length === formValues.addons.length) {
			return;
		}

		formApi.setFieldValue("addons", availableAddons);

		if (!availableAddons.includes("Essential Edit")) {
			formApi.setFieldValue("essentialEditQuantity", "");
		}

		if (!availableAddons.includes("Clip Volume Pack")) {
			formApi.setFieldValue("clipsPackageQuantity", "");
		}
	}, [formApi, formValues.addons, formValues.service]);

	return (
		<FormField name="addons">
			{(field) => {
				function handleAddonChange(addon: BookingAddon, checked: boolean) {
					if (
						checked &&
						addon === "Clip Volume Pack" &&
						!satisfiesClipVolumePackEditRequirement(field.state.value)
					) {
						openClipsPackageRequirementModal();
						return;
					}

					const nextAddons = resolveExclusiveAddonSelection(field.state.value, addon, checked);

					const shouldNotifyClipsPackageDeselected =
						!checked &&
						isClipVolumePackEditAddon(addon) &&
						field.state.value.includes("Clip Volume Pack") &&
						!satisfiesClipVolumePackEditRequirement(nextAddons);

					let resolvedAddons = nextAddons;

					if (shouldNotifyClipsPackageDeselected) {
						resolvedAddons = nextAddons.filter((value) => value !== "Clip Volume Pack");
					}

					field.handleChange(resolvedAddons);
					field.handleBlur();

					if (shouldNotifyClipsPackageDeselected) {
						openClipsPackageDeselectedModal();
					}

					// Clear each hidden editing add-on quantity when its add-on is removed,
					// so the form does not submit stale per-add-on quantities.
					if (!resolvedAddons.includes("Essential Edit")) {
						formApi.setFieldValue("essentialEditQuantity", "");
					}

					if (!resolvedAddons.includes("Clip Volume Pack")) {
						formApi.setFieldValue("clipsPackageQuantity", "");
					}
				}

				return (
					<div
						data-field-name="addons"
						className="flex flex-col gap-8">
						{ADDON_SECTIONS.map((section) => {
							const sectionAddons = section.addons.filter((addon) =>
								availableAddonOptions.includes(addon)
							);

							if (sectionAddons.length === 0) {
								return null;
							}

							return (
								<FieldSet key={section.title}>
									<FieldLegend className={sectionHeadingClassName}>{section.title}</FieldLegend>
									<FieldDescription>{section.description}</FieldDescription>
									<div className="flex flex-col gap-4">
										{sectionAddons.map((addon) => (
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
													{addon === "Essential Edit" &&
													field.state.value.includes("Essential Edit") ? (
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
													{addon === "Clip Volume Pack" &&
													field.state.value.includes("Clip Volume Pack") ? (
														<BookingAddonQuantityField
															key="clipsPackageQuantity"
															formApi={formApi}
															fieldName="clipsPackageQuantity"
															label={
																isMultiBooking
																	? "Number of Clip Volume Packs Per Session"
																	: "Number of Clip Volume Packs"
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
						})}
					</div>
				);
			}}
		</FormField>
	);
}
