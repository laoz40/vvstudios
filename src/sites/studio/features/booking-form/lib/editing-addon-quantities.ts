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

export const dashboardSetupBadgeClassName = "border-foreground/30 bg-foreground/10 text-foreground";

const editingAddonBadgeClassName = "border-primary/40 bg-primary/10 text-primary";

const dashboardAddonBadgeClassNameMap = {
	"Remote Podcast": dashboardSetupBadgeClassName,
	"4K UHD Recording": editingAddonBadgeClassName,
	Teleprompter: dashboardSetupBadgeClassName,
	"Essential Edit": editingAddonBadgeClassName,
	"Complete Edit": editingAddonBadgeClassName,
	"Clip Volume Pack": editingAddonBadgeClassName,
	"Handcrafted Clips": editingAddonBadgeClassName
} satisfies Record<BookingAddon, string>;

const dashboardAddonOrderMap = {
	"Remote Podcast": 0,
	Teleprompter: 1,
	"4K UHD Recording": 2,
	"Essential Edit": 3,
	"Complete Edit": 4,
	"Clip Volume Pack": 5,
	"Handcrafted Clips": 6
} satisfies Record<BookingAddon, number>;

function isDashboardAddonLabelKey(addon: string): addon is BookingAddon {
	return addon in dashboardAddonLabelMap;
}

function getDashboardAddonLabel(addon: string) {
	if (!isDashboardAddonLabelKey(addon)) {
		return addon;
	}

	return dashboardAddonLabelMap[addon];
}

function getDashboardAddonOrder(addon: string) {
	if (!isDashboardAddonLabelKey(addon)) {
		return Number.MAX_SAFE_INTEGER;
	}

	return dashboardAddonOrderMap[addon];
}

export function sortDashboardAddons(addons: readonly string[]) {
	return addons.toSorted((a, b) => getDashboardAddonOrder(a) - getDashboardAddonOrder(b));
}

export function getDashboardAddonBadgeClassName(addon: string) {
	if (!isDashboardAddonLabelKey(addon)) {
		return undefined;
	}

	return dashboardAddonBadgeClassNameMap[addon];
}

export function formatDashboardAddonLabel(addon: string, quantities: EditingAddonQuantities) {
	const label = getDashboardAddonLabel(addon);
	const quantity = getEditingAddonQuantity(addon, quantities, 1);

	return quantity > 1 ? `${quantity} x ${label}` : label;
}
