import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";

export const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

export const bookingAddonsValidator = v.array(bookingAddonValidator);
