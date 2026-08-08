import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import {
	createBookingCustomInvoiceService,
	createPackageCustomInvoiceService,
	listCustomInvoicesForBookingService,
	listCustomInvoicesForPackageService
} from "#convex/services/customInvoices";

export const createCustomInvoice = mutation({
	args: {
		bookingId: v.id("bookings"),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		includeDepositLineItem: v.boolean(),
		customTotalDueAmount: v.optional(v.number())
	},
	handler: async (ctx, args) =>
		createBookingCustomInvoiceService(ctx, args).match(tupleOk, tupleErr)
});

export const createPackageCustomInvoice = mutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		dueDate: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		includeDepositLineItem: v.boolean(),
		includePackageDiscount: v.optional(v.boolean()),
		customTotalDueAmount: v.optional(v.number())
	},
	handler: async (ctx, args) =>
		createPackageCustomInvoiceService(ctx, args).match(tupleOk, tupleErr)
});

export const listCustomInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		listCustomInvoicesForBookingService(ctx, args).match(tupleOk, tupleErr)
});

export const listCustomInvoicesForPackage = query({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: async (ctx, args) =>
		listCustomInvoicesForPackageService(ctx, args).match(tupleOk, tupleErr)
});

export const getBookingCustomInvoiceInput = internalQuery({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.id("customInvoices") },
	handler: async (ctx, args) => {
		const customInvoice = await ctx.db.get(args.customInvoiceId);

		if (customInvoice?.bookingId !== args.bookingId) {
			return null;
		}

		return customInvoice;
	}
});

export const getPackageCustomInvoiceInput = internalQuery({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: async (ctx, args) => {
		const customInvoice = await ctx.db.get(args.customInvoiceId);

		if (!customInvoice?.multiBookingId) {
			return null;
		}

		const multiBooking = await ctx.db.get(customInvoice.multiBookingId);

		if (!multiBooking) {
			return null;
		}

		return { customInvoice, multiBooking };
	}
});
