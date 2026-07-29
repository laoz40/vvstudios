import { v } from "convex/values";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Id } from "./_generated/dataModel";
import {
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { err, ok } from "#/lib/result";
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

function isInvalidCustomTotalDueAmount(amount: number | undefined) {
	return amount !== undefined && (!Number.isFinite(amount) || amount < 0);
}

async function createCustomInvoiceHandler(ctx: MutationCtx, args: CreateCustomInvoiceArgs) {
	const [authError, identity] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	if (isInvalidCustomTotalDueAmount(args.customTotalDueAmount)) {
		return err({ reason: "INVALID_CUSTOM_TOTAL_DUE_AMOUNT" });
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
	handler: (ctx, args) => createPackageCustomInvoiceHandler(ctx, args)
});

type CreatePackageCustomInvoiceArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	dueDate?: string;
	duration?: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	packageSize: 4 | 8 | 12;
	includeDepositLineItem: boolean;
	includePackageDiscount?: boolean;
	customTotalDueAmount?: number;
};

async function createPackageCustomInvoiceHandler(
	ctx: MutationCtx,
	args: CreatePackageCustomInvoiceArgs
) {
	const [authError, identity] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	if (isInvalidCustomTotalDueAmount(args.customTotalDueAmount)) {
		return err({ reason: "INVALID_CUSTOM_TOTAL_DUE_AMOUNT" });
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const createdAt = Date.now();
	const customInvoiceId = await ctx.db.insert("customInvoices", {
		multiBookingId: args.multiBookingId,
		invoiceNumber: "pending",
		dueDate: args.dueDate,
		duration: args.duration,
		addons: args.addons,
		essentialEditQuantity: args.essentialEditQuantity,
		clipsPackageQuantity: args.clipsPackageQuantity,
		packageSize: args.packageSize,
		includeDepositLineItem: args.includeDepositLineItem,
		includePackageDiscount: args.includePackageDiscount,
		customTotalDueAmount: args.customTotalDueAmount,
		createdAt,
		createdBy: identity.email
	});
	const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

	await ctx.db.patch(customInvoiceId, { invoiceNumber });

	return ok({ customInvoiceId, invoiceNumber, createdAt });
}

export type CreatePackageCustomInvoiceResult = Awaited<
	ReturnType<typeof createPackageCustomInvoiceHandler>
>;

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

export const listCustomInvoicesForPackage = query({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => listCustomInvoicesForPackageHandler(ctx, args)
});

async function listCustomInvoicesForPackageHandler(
	ctx: QueryCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const customInvoices = await ctx.db
		.query("customInvoices")
		.withIndex("by_multiBookingId", (q) => q.eq("multiBookingId", args.multiBookingId))
		.order("desc")
		.collect();

	return ok(customInvoices);
}

export type ListCustomInvoicesForPackageResult = Awaited<
	ReturnType<typeof listCustomInvoicesForPackageHandler>
>;

export const getBookingCustomInvoiceSource = internalQuery({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.id("customInvoices") },
	handler: async (ctx, args) => {
		const customInvoice = await ctx.db.get(args.customInvoiceId);

		if (customInvoice?.bookingId !== args.bookingId) {
			return null;
		}

		return customInvoice;
	}
});

export const getPackageCustomInvoiceSource = internalQuery({
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
