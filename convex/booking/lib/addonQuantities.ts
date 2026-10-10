import { v, type ObjectType, type VString } from "convex/values";
import { ADDON_OPTIONS, type BookingAddon } from "#/domain/booking/catalog";
import {
	BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON,
	type BookingAddonQuantityFieldName
} from "#/domain/booking/addon-quantities";

export const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

export const bookingAddonsValidator = v.array(bookingAddonValidator);

const CLIENT_ASSETS_EMAIL_ADDONS = new Set<BookingAddon>(["Complete Edit", "Handcrafted Clips"]);

export function bookingRequiresClientAssetsEmail(addons: readonly BookingAddon[]) {
	return addons.some((addon) => CLIENT_ASSETS_EMAIL_ADDONS.has(addon));
}

export const bookingAddonQuantitiesValidator = {
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Essential Edit"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Complete Edit"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Clip Volume Pack"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Handcrafted Clips"]]: v.optional(v.string())
} satisfies Record<BookingAddonQuantityFieldName, VString<string | undefined, "optional">>;

export type BookingAddonQuantitiesArgs = ObjectType<typeof bookingAddonQuantitiesValidator>;
