import type { ObjectType } from "convex/values";
import type { BookingAddon } from "#/domain/booking/catalog";
import type { bookingAddonQuantitiesValidator } from "#convex/sessions/checkout";

const CLIENT_ASSETS_EMAIL_ADDONS = new Set<BookingAddon>(["Complete Edit", "Handcrafted Clips"]);

export function bookingRequiresClientAssetsEmail(addons: readonly BookingAddon[]) {
	return addons.some((addon) => CLIENT_ASSETS_EMAIL_ADDONS.has(addon));
}

export type BookingAddonQuantitiesArgs = ObjectType<typeof bookingAddonQuantitiesValidator>;
