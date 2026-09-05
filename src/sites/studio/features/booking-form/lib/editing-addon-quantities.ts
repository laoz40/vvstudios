import {
	BOOKING_ADDON_QUANTITY_FIELD_CONFIG,
	hasEditingAddon,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";

export type EditingAddonQuantities = BookingAddonQuantities;

const dashboardAddonLabelMap = {
	"Remote Podcast": "Remote",
	"4K UHD Recording": "4K",
	Teleprompter: "Tele",
	"Essential Edit": "Min Edit",
	"Complete Edit": "Full Edit",
	"Clip Volume Pack": "Vol Clips",
	"Handcrafted Clips": "HC Clips"
} satisfies Record<BookingAddon, string>;

function isDashboardAddonLabelKey(addon: string): addon is BookingAddon {
	return addon in dashboardAddonLabelMap;
}

function getDashboardAddonLabel(addon: string) {
	if (!isDashboardAddonLabelKey(addon)) {
		return addon;
	}

	return dashboardAddonLabelMap[addon];
}

function getEditingAddonQuantityField(addon: string) {
	if (addon === "Essential Edit") {
		return BOOKING_ADDON_QUANTITY_FIELD_CONFIG["Essential Edit"].fieldName;
	}

	if (addon === "Complete Edit") {
		return BOOKING_ADDON_QUANTITY_FIELD_CONFIG["Complete Edit"].fieldName;
	}

	if (addon === "Clip Volume Pack") {
		return BOOKING_ADDON_QUANTITY_FIELD_CONFIG["Clip Volume Pack"].fieldName;
	}

	if (addon === "Handcrafted Clips") {
		return BOOKING_ADDON_QUANTITY_FIELD_CONFIG["Handcrafted Clips"].fieldName;
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

export function formatDashboardAddonLabel(addon: string, quantities: EditingAddonQuantities) {
	const label = getDashboardAddonLabel(addon);
	const quantity = getEditingAddonQuantity(addon, quantities, 1);

	return quantity > 1 ? `${quantity} x ${label}` : label;
}

export function formatEditingAddonLabel(addon: string, quantities: EditingAddonQuantities) {
	const quantity = getEditingAddonQuantity(addon, quantities, 1);

	return quantity > 1 ? `${quantity} x ${addon}` : addon;
}

export function formatEditingAddonList(
	addons: readonly string[],
	quantities: EditingAddonQuantities
) {
	return addons.map((addon) => formatEditingAddonLabel(addon, quantities)).join(", ");
}
