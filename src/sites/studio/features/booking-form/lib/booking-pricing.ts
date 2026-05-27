import {
	EDITING_ADDONS,
	type BookingAddon,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";

export const DURATION_PRICES = {
	"1h": 200,
	"2h": 299,
	"3h": 399,
} as const satisfies Record<Exclude<BookingFormValues["duration"], "">, number>;

export const ADDON_PRICES = {
	"4K UHD Recording": 49,
	"Essential Edit": 99,
	"Clips Package": 79,
	"Remote Podcast": 59,
} as const satisfies Record<BookingAddon, number>;

export function formatBookingPrice(price: number) {
	return `$${price}`;
}

export function getEditingAddonQuantity(addon: BookingAddon, deliverableCount: string | undefined) {
	if (!EDITING_ADDONS.includes(addon as (typeof EDITING_ADDONS)[number])) {
		return 1;
	}

	const quantity = Number(deliverableCount);
	return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

export function getBookingTotal(
	values: Pick<BookingFormValues, "addons" | "deliverableCount" | "duration">,
) {
	const durationTotal = values.duration ? DURATION_PRICES[values.duration] : 0;
	const addonsTotal = values.addons.reduce((total, addon) => {
		return total + ADDON_PRICES[addon] * getEditingAddonQuantity(addon, values.deliverableCount);
	}, 0);

	return durationTotal + addonsTotal;
}
