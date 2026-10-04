import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";

export {
	bookingAddonQuantitiesValidator,
	bookingAddonValidator,
	bookingAddonsValidator,
	type BookingAddonQuantitiesArgs
} from "#convex/validators/bookingAddonQuantities";

const CLIENT_ASSETS_EMAIL_ADDONS = new Set<BookingAddon>(["Complete Edit", "Handcrafted Clips"]);

export function bookingRequiresClientAssetsEmail(addons: readonly BookingAddon[]) {
	return addons.some((addon) => CLIENT_ASSETS_EMAIL_ADDONS.has(addon));
}
