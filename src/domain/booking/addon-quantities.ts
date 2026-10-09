import {
	ADDON_OPTIONS,
	getCustomerAddonDisplayLabel,
	type BookingAddon
} from "#/domain/booking/catalog";

export const BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON = {
	"Essential Edit": "essentialEditQuantity",
	"Complete Edit": "completeEditQuantity",
	"Clip Volume Pack": "clipsPackageQuantity",
	"Handcrafted Clips": "handcraftedClipsQuantity"
} as const satisfies Partial<Record<BookingAddon, string>>;

export type QuantityTrackedAddon = keyof typeof BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON;

export type BookingAddonQuantityFieldName =
	(typeof BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON)[QuantityTrackedAddon];

export type BookingAddonQuantities = Partial<Record<BookingAddonQuantityFieldName, string>>;

export const QUANTITY_TRACKED_ADDONS = ADDON_OPTIONS.filter(isQuantityTrackedAddon);

export const BOOKING_ADDON_QUANTITY_FIELD_NAMES = Object.values(
	BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON
);

export function isQuantityTrackedAddon(addon: string): addon is QuantityTrackedAddon {
	return Object.hasOwn(BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON, addon);
}

export function getClearedAddonQuantityUpdates(
	selectedAddons: readonly BookingAddon[]
): Partial<Record<BookingAddonQuantityFieldName, "">> {
	const updates: Partial<Record<BookingAddonQuantityFieldName, "">> = {};

	for (const addon of QUANTITY_TRACKED_ADDONS) {
		const fieldName = BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON[addon];

		if (!selectedAddons.includes(addon)) {
			updates[fieldName] = "";
		}
	}

	return updates;
}

export function forEachClearedAddonQuantityField(
	selectedAddons: readonly BookingAddon[],
	callback: (fieldName: BookingAddonQuantityFieldName, value: "") => void
) {
	const updates = getClearedAddonQuantityUpdates(selectedAddons);

	for (const fieldName of BOOKING_ADDON_QUANTITY_FIELD_NAMES) {
		const value = updates[fieldName];

		if (value !== undefined) {
			callback(fieldName, value);
		}
	}
}

export function hasEditingAddon(addons: readonly BookingAddon[]) {
	return addons.some(isQuantityTrackedAddon);
}

export function pickBookingAddonQuantities(values: BookingAddonQuantities): BookingAddonQuantities {
	const quantities: BookingAddonQuantities = {};

	for (const fieldName of BOOKING_ADDON_QUANTITY_FIELD_NAMES) {
		quantities[fieldName] = values[fieldName];
	}

	return quantities;
}

export function getEditingAddonQuantity(
	addon: string,
	quantities: BookingAddonQuantities = {},
	fallbackQuantity = 0
) {
	const fieldName = isQuantityTrackedAddon(addon)
		? BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON[addon]
		: undefined;

	const quantity = Number(fieldName ? quantities[fieldName] : undefined);

	return Number.isInteger(quantity) && quantity > 0 ? quantity : fallbackQuantity;
}

export function getBookingAddonQuantityForForm(
	addon: BookingAddon,
	quantities: BookingAddonQuantities
) {
	if (!hasEditingAddon([addon])) {
		return 1;
	}

	return getEditingAddonQuantity(addon, quantities, 0);
}

export function formatEditingAddonLabel(addon: string, quantities: BookingAddonQuantities) {
	const quantity = getEditingAddonQuantity(addon, quantities, 1);
	const label = getCustomerAddonDisplayLabel(addon);

	return quantity > 1 ? `${quantity} x ${label}` : label;
}

export function formatEditingAddonList(
	addons: readonly string[],
	quantities: BookingAddonQuantities
) {
	return addons.map((addon) => formatEditingAddonLabel(addon, quantities)).join(", ");
}
