import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { requirePermission } from "#convex/lib/auth";
import {
	saveNumberedCustomInvoice,
	validateCustomTotalDueAmount
} from "#convex/lib/customInvoices";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDb } from "#convex/lib/sessionLookup";

type CustomInvoiceDetails = {
	dueDate?: string;
	duration?: string;
	addons: string[];
	includeDepositLineItem: boolean;
	customTotalDueAmount?: number;
} & BookingAddonQuantitiesArgs;

export type CreateBookingCustomInvoiceArgs = CustomInvoiceDetails & {
	bookingId: Id<"bookings">;
	service?: string;
};

export type CreatePackageCustomInvoiceArgs = CustomInvoiceDetails & {
	multiBookingId: Id<"multiBookingPackages">;
	packageSize: 4 | 8 | 12;
	includePackageDiscount?: boolean;
};

export function listCustomInvoicesForBookingService(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		okOrThrow(
			ctx.db
				.query("customInvoices")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
				.order("desc")
				.collect()
		)
	);
}

export function listCustomInvoicesForPackageService(
	ctx: QueryCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		okOrThrow(
			ctx.db
				.query("customInvoices")
				.withIndex("by_multiBookingId", (query) => query.eq("multiBookingId", args.multiBookingId))
				.order("desc")
				.collect()
		)
	);
}

export function createBookingCustomInvoiceService(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return (
		requirePermission(ctx, "create:invoices")
			// Validate the optional price override before loading or writing invoice data.
			.andThen((identity) =>
				validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => identity)
			)
			// Confirm the session still exists before creating its custom invoice.
			.andThen((identity) => getSessionFromDb(ctx, args.bookingId).map(() => identity))
			// Save and number the invoice in the same transaction.
			.andThen((identity) =>
				saveNumberedCustomInvoice(ctx, {
					bookingId: args.bookingId,
					dueDate: args.dueDate,
					service: args.service,
					duration: args.duration,
					addons: args.addons,
					essentialEditQuantity: args.essentialEditQuantity,
					completeEditQuantity: args.completeEditQuantity,
					clipsPackageQuantity: args.clipsPackageQuantity,
					handcraftedClipsQuantity: args.handcraftedClipsQuantity,
					includeDepositLineItem: args.includeDepositLineItem,
					customTotalDueAmount: args.customTotalDueAmount,
					createdBy: identity.email
				})
			)
	);
}

export function createPackageCustomInvoiceService(
	ctx: MutationCtx,
	args: CreatePackageCustomInvoiceArgs
) {
	return (
		requirePermission(ctx, "create:invoices")
			// Validate the optional price override before loading or writing invoice data.
			.andThen((identity) =>
				validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => identity)
			)
			// Confirm the package still exists before creating its custom invoice.
			.andThen((identity) => getPackageFromDb(ctx, args.multiBookingId).map(() => identity))
			// Save and number the invoice in the same transaction.
			.andThen((identity) =>
				saveNumberedCustomInvoice(ctx, {
					multiBookingId: args.multiBookingId,
					dueDate: args.dueDate,
					duration: args.duration,
					addons: args.addons,
					essentialEditQuantity: args.essentialEditQuantity,
					completeEditQuantity: args.completeEditQuantity,
					clipsPackageQuantity: args.clipsPackageQuantity,
					handcraftedClipsQuantity: args.handcraftedClipsQuantity,
					packageSize: args.packageSize,
					includeDepositLineItem: args.includeDepositLineItem,
					includePackageDiscount: args.includePackageDiscount,
					customTotalDueAmount: args.customTotalDueAmount,
					createdBy: identity.email
				})
			)
	);
}
