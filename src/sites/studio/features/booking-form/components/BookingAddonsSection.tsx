import { useState } from "react";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "#/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Modal } from "#studio/components/Modal";
import {
	BookingAddonCard,
	type BookingAddon,
} from "#studio/features/booking-form/components/BookingAddonCard";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import {
	ADDON_OPTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	hasEditingAddon,
	toFieldErrorObjects,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";

const [remotePodcastAddon, fourKAddon] = ADDON_OPTIONS;

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const [isCompatibilityDialogOpen, setIsCompatibilityDialogOpen] = useState(false);

	return (
		<>
			<formApi.Field name="addons">
				{(field) => {
					function handleAddonChange(addon: BookingAddon, checked: boolean) {
						let nextAddons = field.state.value.filter((value) => value !== addon);

						if (checked) {
							nextAddons = [...field.state.value, addon];
						}

						// Remote Podcast records through Riverside.fm, which does not support 4K.
						// If both are selected, keep Remote Podcast and remove the 4K add-on.
						const isIncompatibleSelection =
							checked && nextAddons.includes(remotePodcastAddon) && nextAddons.includes(fourKAddon);

						if (isIncompatibleSelection) {
							nextAddons = nextAddons.filter((value) => value !== fourKAddon);
							setIsCompatibilityDialogOpen(true);
						}

						field.handleChange(nextAddons as BookingFormValues["addons"]);
						field.handleBlur();

						// Clear the hidden deliverable count when no editing add-ons remain,
						// so non-editing bookings don't submit stale deliverable values.
						if (!hasEditingAddon(nextAddons as BookingAddon[])) {
							formApi.setFieldValue("deliverableCount", "");
						}
					}

					const showDeliverableCount = hasEditingAddon(field.state.value);

					return (
						<FieldSet data-field-name="addons">
							<FieldLegend className={sectionHeadingClassName}>Add-ons</FieldLegend>
							<FieldDescription>Choose add-ons to enhance your session.</FieldDescription>
							<div className="flex flex-col gap-4">
								{ADDON_OPTIONS.map((addon) => (
									<BookingAddonCard
										key={addon}
										addon={addon}
										checked={field.state.value.includes(addon)}
										onCheckedChange={handleAddonChange}
									/>
								))}
							</div>
							<AnimatePresence initial={false}>
								{showDeliverableCount ? (
									<motion.div
										key="deliverable-count"
										initial={{ height: 0, opacity: 0, y: -8 }}
										animate={{ height: "auto", opacity: 1, y: 0 }}
										exit={{ height: 0, opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: "easeOut" }}
										className="overflow-hidden">
										<formApi.Field name="deliverableCount">
											{(deliverableCountField) => (
												<Field className="gap-3 pt-2">
													<div className="space-y-2">
														<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
															<FieldTitle className="text-base">Number of deliverables:</FieldTitle>
															<RadioGroup
																value={deliverableCountField.state.value}
																onValueChange={(value) => {
																	deliverableCountField.handleChange(
																		value as BookingFormValues["deliverableCount"],
																	);
																	deliverableCountField.handleBlur();
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
														<FieldDescription className="italic">
															Editing add-ons are charged per deliverable (e.g. each episode
															recorded in your session).
														</FieldDescription>
													</div>
													{deliverableCountField.state.meta.isBlurred || shouldShowFieldError ? (
														<FieldError
															errors={toFieldErrorObjects(deliverableCountField.state.meta.errors)}
														/>
													) : null}
												</Field>
											)}
										</formApi.Field>
									</motion.div>
								) : null}
							</AnimatePresence>
						</FieldSet>
					);
				}}
			</formApi.Field>
			<Modal
				open={isCompatibilityDialogOpen}
				onOpenChange={setIsCompatibilityDialogOpen}
				title="4K isn't available for remote podcasts"
				description="Remote Podcast runs through Riverside.fm using our studio setup, which doesn't support our 4K recording addon."
				closeLabel="Close"
				footer={
					<Button
						type="button"
						onClick={() => setIsCompatibilityDialogOpen(false)}>
						Got it
					</Button>
				}
			/>
		</>
	);
}
