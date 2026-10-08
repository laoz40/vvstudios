import { motion, useReducedMotion } from "motion/react";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	BOOKING_ADDON_QUANTITY_FIELD_CONFIG,
	bookingFieldBlurValidator,
	DELIVERABLE_COUNT_OPTIONS,
	isDeliverableCountOption,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";
import { getRevealMotionProps } from "#studio/features/booking-form/lib/booking-form-styles";

type BookingAddonQuantityFieldProps = {
	addon: keyof typeof BOOKING_ADDON_QUANTITY_FIELD_CONFIG;
	isPackageBooking: boolean;
	shouldShowFieldError: boolean;
};

export function BookingAddonQuantityField({
	addon,
	isPackageBooking,
	shouldShowFieldError
}: BookingAddonQuantityFieldProps) {
	const formApi = useBookingFormContext();
	const FormField = formApi.Field;
	const shouldReduceMotion = useReducedMotion();
	const revealMotionProps = getRevealMotionProps(shouldReduceMotion === true);
	const config = BOOKING_ADDON_QUANTITY_FIELD_CONFIG[addon];
	const { fieldName, unitLabels } = config;
	const label = isPackageBooking ? config.labels.multi : config.labels.single;
	const description = config.description;
	const labelId = `${fieldName}-label`;
	const descriptionId = `${fieldName}-description`;
	const errorId = `${fieldName}-error`;

	return (
		<motion.div
			{...revealMotionProps}
			className="mx-3 overflow-hidden rounded-b-lg border border-t-0 bg-input/30 sm:mx-4">
			<FormField
				name={fieldName}
				validators={bookingFieldBlurValidator(fieldName)}>
				{(quantityField) => {
					const errors = toFieldErrorObjects(quantityField.state.meta.errors);

					const isInvalid =
						(quantityField.state.meta.isBlurred || shouldShowFieldError) && errors.length > 0;

					const describedBy =
						[description ? descriptionId : null, isInvalid ? errorId : null]
							.filter(Boolean)
							.join(" ") || undefined;

					return (
						<Field
							data-field-name={fieldName}
							data-invalid={isInvalid}
							className="gap-2 p-4">
							<FieldSet className="gap-2">
								<FieldLegend
									variant="label"
									className="mb-2">
									<span id={labelId}>{label}</span>
									{description ? (
										<>
											{" "}
											<span
												id={descriptionId}
												className="font-normal text-muted-foreground">
												({description})
											</span>
										</>
									) : null}
								</FieldLegend>
								<RadioGroup
									aria-labelledby={labelId}
									aria-describedby={describedBy}
									aria-invalid={isInvalid}
									value={quantityField.state.value}
									onValueChange={(value) => {
										if (isDeliverableCountOption(value)) {
											quantityField.handleChange(value);
											quantityField.handleBlur();
										}
									}}
									className="grid grid-cols-4 gap-2">
									{DELIVERABLE_COUNT_OPTIONS.map((count) => (
										<FieldLabel
											key={count}
											htmlFor={`${fieldName}-${count}`}
											className="relative min-h-9 w-full cursor-pointer items-center justify-center rounded-md border border-transparent bg-input/40 px-3 py-2 font-normal shadow-md shadow-background/40 transition-[background-color,border-color,box-shadow] hover:border-primary/40 hover:bg-primary/10 hover:shadow-lg has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-primary/10">
											<RadioGroupItem
												id={`${fieldName}-${count}`}
												value={count}
												className="sr-only"
												aria-label={`${count} ${count === "1" ? unitLabels.single : unitLabels.plural}`}
												aria-invalid={isInvalid}
											/>
											<span>{count}</span>
										</FieldLabel>
									))}
								</RadioGroup>
							</FieldSet>
							{isInvalid ? (
								<FieldError
									id={errorId}
									errors={errors}
								/>
							) : null}
						</Field>
					);
				}}
			</FormField>
		</motion.div>
	);
}
