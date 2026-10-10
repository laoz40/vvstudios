import { v, type Infer } from "convex/values";
import { bookingDetailsFieldsValidator } from "#convex/booking/services/formValidators";

export const editInvoiceDraftValidator = v.union(
	v.object({
		kind: v.literal("booking"),
		values: v.object({
			...bookingDetailsFieldsValidator,
			bookingId: v.id("bookings"),
			date: v.string(),
			time: v.string(),
			service: v.string()
		})
	}),
	v.object({
		kind: v.literal("package"),
		values: v.object({
			...bookingDetailsFieldsValidator,
			packageId: v.id("packages"),
			packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
			expiresAt: v.optional(v.number())
		})
	})
);

export type EditInvoiceDraft = Infer<typeof editInvoiceDraftValidator>;
