import { motion, useReducedMotion } from "motion/react";
import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	BOOKING_ADDON_QUANTITY_FIELD_NAMES,
	bookingFieldBlurValidator,
	DELIVERABLE_COUNT_OPTIONS,
	isDeliverableCountOption,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";
import { getRevealMotionProps } from "#studio/features/booking-form/lib/booking-form-styles";

type BookingAddonQuantityFieldProps = {
	description: string;
	fieldName: (typeof BOOKING_ADDON_QUANTITY_FIELD_NAMES)[number];
	label: string;
	shouldShowFieldError: boolean;
};

export function BookingAddonQuantityField({
	description,
	fieldName,
	label,
	shouldShowFieldError
}: BookingAddonQuantityFieldProps) {
	const formApi = useBookingFormContext();
	const FormField = formApi.Field;
	const shouldReduceMotion = useReducedMotion();
	const revealMotionProps = getRevealMotionProps(shouldReduceMotion === true);

	return (
		<motion.div
			key={fieldName}
			{...revealMotionProps}
			className="overflow-hidden">
			<FormField
				name={fieldName}
				validators={bookingFieldBlurValidator(fieldName)}>
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
											className="flex cursor-pointer items-center gap-2 text-sm font-medium has-data-[state=checked]:bg-transparent dark:has-data-[state=checked]:bg-transparent">
											<RadioGroupItem
												value={count}
												className="size-5 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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
