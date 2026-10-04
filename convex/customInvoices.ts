import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import {
	createBookingCustomInvoiceService,
	listCustomInvoicesForBookingService
} from "#convex/services/stripe/customInvoices";

const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

const bookingAddonsValidator = v.array(bookingAddonValidator);

const bookingAddonQuantitiesValidator = {
	essentialEditQuantity: v.optional(v.string()),
	completeEditQuantity: v.optional(v.string()),
	clipsPackageQuantity: v.optional(v.string()),
	handcraftedClipsQuantity: v.optional(v.string())
};

export const createCustomInvoice = mutation({
	args: {
		bookingId: v.id("bookings"),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		includeDepositLineItem: v.boolean(),
		customTotalDueAmount: v.optional(v.number())
	},
	handler: async (ctx, args) =>
		createBookingCustomInvoiceService(ctx, args).match(tupleOk, tupleErr)
});

export const listCustomInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		listCustomInvoicesForBookingService(ctx, args).match(tupleOk, tupleErr)
});

export const getBookingCustomInvoiceInput = internalQuery({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.id("customInvoices") },
	handler: async (ctx, args) => {
		const customInvoice = await ctx.db.get("customInvoices", args.customInvoiceId);

		if (customInvoice?.bookingId !== args.bookingId) {
			return null;
		}

		return customInvoice;
	}
});
