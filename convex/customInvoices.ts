import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { formatBookingInvoiceNumber } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";

type CustomInvoiceErrorData = {
	code: "NOT_AUTHENTICATED" | "BOOKING_NOT_FOUND";
};

export const createCustomInvoice = mutation({
	args: {
		bookingId: v.id("bookings"),
		service: v.optional(v.string()),
		addons: v.array(v.string()),
		includeDepositLineItem: v.boolean(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<CustomInvoiceErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<CustomInvoiceErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		const createdAt = Date.now();
		const customInvoiceId = await ctx.db.insert("customInvoices", {
			bookingId: args.bookingId,
			invoiceNumber: "pending",
			service: args.service,
			addons: args.addons,
			includeDepositLineItem: args.includeDepositLineItem,
			createdAt,
			createdBy: identity.email,
		});
		const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

		await ctx.db.patch(customInvoiceId, { invoiceNumber });

		return { customInvoiceId, invoiceNumber, createdAt };
	},
});

export const listCustomInvoicesForBooking = query({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<CustomInvoiceErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		return await ctx.db
			.query("customInvoices")
			.withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
			.order("desc")
			.collect();
	},
});
