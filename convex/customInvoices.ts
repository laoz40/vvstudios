import { ConvexError, v } from "convex/values";
import { formatBookingInvoiceNumber } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

type CustomInvoiceErrorData = { code: "NOT_AUTHENTICATED" | "BOOKING_NOT_FOUND" };

export const createCustomInvoice = mutation({
	args: {
		bookingId: v.id("bookings"),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		includeDepositLineItem: v.boolean()
	},
	handler: async (ctx, args) => {
		const identity = await requireAdmin(ctx);

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<CustomInvoiceErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		const createdAt = Date.now();
		const customInvoiceId = await ctx.db.insert("customInvoices", {
			bookingId: args.bookingId,
			invoiceNumber: "pending",
			dueDate: args.dueDate,
			service: args.service,
			duration: args.duration,
			addons: args.addons,
			essentialEditQuantity: args.essentialEditQuantity,
			clipsPackageQuantity: args.clipsPackageQuantity,
			includeDepositLineItem: args.includeDepositLineItem,
			createdAt,
			createdBy: identity.email
		});
		const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

		await ctx.db.patch(customInvoiceId, { invoiceNumber });

		return { customInvoiceId, invoiceNumber, createdAt };
	}
});

export const listCustomInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		return await ctx.db
			.query("customInvoices")
			.withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
			.order("desc")
			.collect();
	}
});
