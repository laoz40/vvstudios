import { hasEditingAddon, type BookingAddon } from "#studio/features/booking-form/lib/form-shared";

export type EditingAddonQuantities = {
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
};

function getEditingAddonQuantityField(addon: string) {
	if (addon === "Essential Edit") {
		return "essentialEditQuantity" as const;
	}

	if (addon === "Clips Package") {
		return "clipsPackageQuantity" as const;
	}

	return null;
}

export function getEditingAddonQuantity(
	addon: string,
	quantities: EditingAddonQuantities = {},
	fallbackQuantity = 0
) {
	const field = getEditingAddonQuantityField(addon);
	const rawQuantity = field ? quantities[field] : undefined;
	const quantity = Number(rawQuantity);

	return Number.isInteger(quantity) && quantity > 0 ? quantity : fallbackQuantity;
}

export function getBookingAddonQuantityForForm(
	addon: BookingAddon,
	quantities: EditingAddonQuantities
) {
	if (!hasEditingAddon([addon])) {
		return 1;
	}

	return getEditingAddonQuantity(addon, quantities, 0);
}

export function formatEditingAddonLabel(addon: string, quantities: EditingAddonQuantities) {
	const quantity = getEditingAddonQuantity(addon, quantities, 1);

	return quantity > 1 ? `${quantity} x ${addon}` : addon;
}
