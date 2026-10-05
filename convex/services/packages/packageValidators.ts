import { v } from "convex/values";

export {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/services/booking/bookingFormValidators";

export const packageInvoiceLineItemValidator = v.object({
	amount: v.number(),
	description: v.string(),
	quantity: v.number(),
	rate: v.number()
});
