import { getEditingAddonQuantityForForm } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type {
	BookingAddon,
	BookingFormValues,
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

export { getEditingAddonQuantityForForm as getEditingAddonQuantity };

export function getBookingTotal(
	values: Pick<
		BookingFormValues,
		"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
	>,
) {
	const durationTotal = values.duration ? DURATION_PRICES[values.duration] : 0;
	const addonsTotal = values.addons.reduce((total, addon) => {
		return total + ADDON_PRICES[addon] * getEditingAddonQuantityForForm(addon, values);
	}, 0);

	return durationTotal + addonsTotal;
}
