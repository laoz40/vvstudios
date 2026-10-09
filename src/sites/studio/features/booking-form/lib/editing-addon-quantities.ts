import { getCustomerAddonDisplayLabel, type BookingAddon } from "#/domain/booking/catalog";
import {
	getEditingAddonQuantity,
	type BookingAddonQuantities
} from "#/domain/booking/addon-quantities";

export type EditingAddonQuantities = BookingAddonQuantities;

const dashboardAddonLabelMap = {
	"Remote Podcast": "Remote",
	"4K UHD Recording": "4K",
	Teleprompter: "Tele",
	"Essential Edit": getCustomerAddonDisplayLabel("Essential Edit"),
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

export function formatDashboardAddonLabel(addon: string, quantities: EditingAddonQuantities) {
	const label = getDashboardAddonLabel(addon);
	const quantity = getEditingAddonQuantity(addon, quantities, 1);

	return quantity > 1 ? `${quantity} x ${label}` : label;
}
