import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";

export const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

export const bookingAddonsValidator = v.array(bookingAddonValidator);

export const bookingAddonQuantitiesValidator = {
	essentialEditQuantity: v.optional(v.string()),
	completeEditQuantity: v.optional(v.string()),
	clipsPackageQuantity: v.optional(v.string()),
	handcraftedClipsQuantity: v.optional(v.string())
} as const;

export type BookingAddonQuantitiesArgs = {
	essentialEditQuantity?: string;
	completeEditQuantity?: string;
	clipsPackageQuantity?: string;
	handcraftedClipsQuantity?: string;
};
