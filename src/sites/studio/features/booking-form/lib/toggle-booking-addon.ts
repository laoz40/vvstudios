import type { BookingFormApi } from "#studio/features/booking-form/lib/booking-form-context";
import {
	forEachClearedAddonQuantityField,
	isClipVolumePackEditAddon,
	resolveExclusiveAddonSelection,
	satisfiesClipVolumePackEditRequirement,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	openClipsPackageDeselectedModal,
	openClipsPackageRequirementModal
} from "#studio/features/booking-form/lib/booking-modal-store";

export function toggleBookingAddon(
	formApi: BookingFormApi,
	addon: BookingAddon,
	checked: boolean
): void {
	const selectedAddons = formApi.state.values.addons;

	if (
		checked &&
		addon === "Clip Volume Pack" &&
		!satisfiesClipVolumePackEditRequirement(selectedAddons)
	) {
		openClipsPackageRequirementModal();

		return;
	}

	const nextAddons = resolveExclusiveAddonSelection(selectedAddons, addon, checked);

	const shouldNotifyClipsPackageDeselected =
		!checked &&
		isClipVolumePackEditAddon(addon) &&
		selectedAddons.includes("Clip Volume Pack") &&
		!satisfiesClipVolumePackEditRequirement(nextAddons);

	let resolvedAddons = nextAddons;

	if (shouldNotifyClipsPackageDeselected) {
		resolvedAddons = nextAddons.filter((value) => value !== "Clip Volume Pack");
	}

	formApi.setFieldValue("addons", resolvedAddons);

	forEachClearedAddonQuantityField(resolvedAddons, (fieldName, value) => {
		formApi.setFieldValue(fieldName, value);
	});

	if (shouldNotifyClipsPackageDeselected) {
		openClipsPackageDeselectedModal();
	}
}
