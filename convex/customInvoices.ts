import { v } from "convex/values";
import { formatBookingInvoiceNumber } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { err, ok } from "../src/lib/result";
import { getAdminIdentity } from "./lib/auth";

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
	handler: (ctx, args) => createCustomInvoiceHandler(ctx, args)
});

type CreateCustomInvoiceArgs = {
	bookingId: Id<"bookings">;
	dueDate?: string;
	service?: string;
	duration?: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	includeDepositLineItem: boolean;
	customTotalDueAmount?: number;
};

async function createCustomInvoiceHandler(ctx: MutationCtx, args: CreateCustomInvoiceArgs) {
	const [authError, identity] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
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
		customTotalDueAmount: args.customTotalDueAmount,
		createdAt,
		createdBy: identity.email
	});
	const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

	await ctx.db.patch(customInvoiceId, { invoiceNumber });

	return ok({ customInvoiceId, invoiceNumber, createdAt });
}

export type CreateCustomInvoiceResult = Awaited<ReturnType<typeof createCustomInvoiceHandler>>;

export const listCustomInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => listCustomInvoicesForBookingHandler(ctx, args)
});

async function listCustomInvoicesForBookingHandler(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings"> }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const customInvoices = await ctx.db
		.query("customInvoices")
		.withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
		.order("desc")
		.collect();

	return ok(customInvoices);
}

export type ListCustomInvoicesForBookingResult = Awaited<
	ReturnType<typeof listCustomInvoicesForBookingHandler>
>;
