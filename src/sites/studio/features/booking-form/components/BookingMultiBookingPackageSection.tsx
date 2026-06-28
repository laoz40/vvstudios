import { useSelector } from "@tanstack/react-store";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { cn } from "#/lib/utils";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	toFieldErrorObjects,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	MULTI_BOOKING_PLANS,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	getCardStateClassName,
	getRevealMotionProps,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";

const packageSizeOptions = Object.entries(MULTI_BOOKING_PLANS).map(([packageSize, plan]) => ({
	packageSize: Number(packageSize) as MultiBookingSize,
	discountPercent: plan.discountPercent,
	validityMonths: Math.round(plan.validityDays / 30)
}));

export function BookingMultiBookingPackageSection() {
	const formApi = useBookingFormContext();
	const formValues = useSelector(formApi.store, (state) => state.values);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	const isPackageBooking = formValues.bookingMode === "multi";
	const shouldReduceMotion = useReducedMotion();
	const revealMotionProps = getRevealMotionProps(shouldReduceMotion === true);

	return (
		<AnimatePresence initial={false}>
			{isPackageBooking ? (
				<motion.div
					key="package-size-section"
					{...revealMotionProps}
					className="overflow-hidden">
					<div className="pt-8 md:pt-12">
						<formApi.Field name="packageSize">
							{(field) => {
								const selectedPackageOption = packageSizeOptions.find(
									(option) => option.packageSize === field.state.value
								);
								const packageSizeNote = selectedPackageOption
									? `The ${selectedPackageOption.packageSize} session package will be valid for ${selectedPackageOption.validityMonths} months.`
									: "Package size affects how long you have to select and use your session dates.";

								return (
									<FieldSet data-field-name="packageSize">
										<FieldLegend className={sectionHeadingClassName}>Package size *</FieldLegend>
										<RadioGroup
											value={String(field.state.value)}
											onValueChange={(value) => {
												field.handleChange(Number(value) as BookingFormValues["packageSize"]);
												field.handleBlur();
											}}
											className="grid gap-4 sm:grid-cols-3">
											{packageSizeOptions.map((option) => {
												const isSelected = field.state.value === option.packageSize;
												const discountLabel = `${option.discountPercent}%`;

												return (
													<div key={option.packageSize}>
														<RadioGroupItem
															value={String(option.packageSize)}
															id={`package-size-${option.packageSize}`}
															className="peer sr-only size-0"
														/>
														<label
															htmlFor={`package-size-${option.packageSize}`}
															className={cn(
																"pressable flex cursor-pointer flex-col rounded-lg border bg-input/30",
																"p-4 shadow-lg shadow-background/25",
																"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
																"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
																transitionClassName,
																getCardStateClassName(isSelected),
																isSelected && "shadow-primary/20"
															)}>
															<div className="flex items-center justify-between gap-3">
																<div>
																	<p className="text-lg font-semibold text-foreground">
																		{option.packageSize} sessions
																	</p>
																	<p className="text-sm font-semibold text-primary">
																		Save {discountLabel}
																	</p>
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
															</div>
														</label>
													</div>
												);
											})}
										</RadioGroup>
										{field.state.meta.isBlurred || shouldShowFieldError ? (
											<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
										) : null}
										<p className="text-sm italic text-muted-foreground">
											Scheduling is available after full payment. Session duration and addons do not
											change between sessions. {packageSizeNote}
										</p>
									</FieldSet>
								);
							}}
						</formApi.Field>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
