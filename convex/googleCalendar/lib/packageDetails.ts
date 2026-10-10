import { v, type Infer } from "convex/values";
import { DURATION_OPTIONS, SERVICES } from "#/domain/booking/catalog";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/lib/addonQuantities";

export const packageCalendarDetailsValidator = v.object({
	addons: bookingAddonsValidator,
	...bookingAddonQuantitiesValidator,
	date: v.string(),
	duration: v.union(...DURATION_OPTIONS.map((duration) => v.literal(duration))),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.union(...SERVICES.map((service) => v.literal(service))),
	time: v.string()
});

export type PackageCalendarDetails = Infer<typeof packageCalendarDetailsValidator>;
