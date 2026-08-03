import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { getAdminIdentity } from "./lib/auth";
import { okOrThrow } from "./lib/result";
import {
	createBookingCustomInvoiceService,
	createPackageCustomInvoiceService,
	type CreateBookingCustomInvoiceArgs,
	type CreatePackageCustomInvoiceArgs
} from "./services/customInvoices";

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

async function createCustomInvoiceHandler(ctx: MutationCtx, args: CreateBookingCustomInvoiceArgs) {
	return createBookingCustomInvoiceService(ctx, args).match(tupleOk, tupleErr);
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

async function createPackageCustomInvoiceHandler(
	ctx: MutationCtx,
	args: CreatePackageCustomInvoiceArgs
) {
	return createPackageCustomInvoiceService(ctx, args).match(tupleOk, tupleErr);
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
	return getAdminIdentity(ctx)
		.andThen(() =>
			okOrThrow(
				ctx.db
					.query("customInvoices")
					.withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
					.order("desc")
					.collect()
			)
		)
		.match(tupleOk, tupleErr);
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
	return getAdminIdentity(ctx)
		.andThen(() =>
			okOrThrow(
				ctx.db
					.query("customInvoices")
					.withIndex("by_multiBookingId", (q) => q.eq("multiBookingId", args.multiBookingId))
					.order("desc")
					.collect()
			)
		)
		.match(tupleOk, tupleErr);
}

export type ListCustomInvoicesForPackageResult = Awaited<
	ReturnType<typeof listCustomInvoicesForPackageHandler>
>;

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
