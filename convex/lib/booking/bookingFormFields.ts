import { v } from "convex/values";
import {
	bookingAddonsValidator,
	bookingAddonQuantitiesValidator
} from "#convex/lib/booking/bookingAddonQuantities";

export const bookingDetailsFieldsValidator = {
	name: v.string(),
	phone: v.string(),
	accountName: v.string(),
	abn: v.optional(v.string()),
	email: v.string(),
	duration: v.string(),
	addons: bookingAddonsValidator,
	...bookingAddonQuantitiesValidator,
	notes: v.optional(v.string())
};
