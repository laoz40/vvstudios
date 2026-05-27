import { useState } from "react";
import { Button } from "#/components/ui/button";
import { FieldDescription, FieldLegend, FieldSet } from "#/components/ui/field";
import { Modal } from "#studio/components/Modal";
import {
	BookingAddonCard,
	type BookingAddon,
} from "#studio/features/booking-form/components/BookingAddonCard";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import {
	ADDON_OPTIONS,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";

const sectionTitle = "Add-ons";
const sectionDescription = "Choose add-ons to enhance your session.";

const [remotePodcastAddon, fourKAddon] = ADDON_OPTIONS;

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();
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
					}

					return (
						<FieldSet data-field-name="addons">
							<FieldLegend className={sectionHeadingClassName}>{sectionTitle}</FieldLegend>
							<FieldDescription>{sectionDescription}</FieldDescription>
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
						</FieldSet>
					);
				}}
			</formApi.Field>
			<Modal
				open={isCompatibilityDialogOpen}
				onOpenChange={setIsCompatibilityDialogOpen}
				title="4K isn't available for remote podcasts"
				description="Remote Podcast uses our studio setup for your side of a Riverside.fm call, which doesn't support 4K recording."
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
