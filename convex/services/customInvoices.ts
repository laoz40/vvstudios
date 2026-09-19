import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { requirePermission } from "#convex/lib/auth";
import {
	saveNumberedCustomInvoice,
	validateCustomTotalDueAmount
} from "#convex/lib/customInvoices";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDb } from "#convex/lib/sessionLookup";

type CustomInvoiceDetails = {
	dueDate?: string;
	duration?: string;
	addons: BookingAddon[];
	includeDepositLineItem: boolean;
	customTotalDueAmount?: number;
} & BookingAddonQuantitiesArgs;

export type CreateBookingCustomInvoiceArgs = CustomInvoiceDetails & {
	bookingId: Id<"bookings">;
	service?: string;
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

export function createBookingCustomInvoiceService(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return requirePermission(ctx, "create:invoices")
		.andThen((identity) =>
			validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => identity)
		)
		.andThen((identity) => getSessionFromDb(ctx, args.bookingId).map(() => identity))
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
		);
}
