import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/services/bookingFormValidators";
import {
	createBookingCustomInvoiceFromAdmin,
	listCustomInvoicesForBooking as listCustomInvoicesForBookingStep,
	loadBookingCustomInvoiceInput
} from "#convex/stripe/services/bookingCustomInvoice";

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
		createBookingCustomInvoiceFromAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const listCustomInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => listCustomInvoicesForBookingStep(ctx, args).match(tupleOk, tupleErr)
});

export const getBookingCustomInvoiceInput = internalQuery({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.id("customInvoices") },
	handler: async (ctx, args) =>
		(await loadBookingCustomInvoiceInput(ctx, args)).match(
			(customInvoice) => customInvoice,
			() => null
		)
});
