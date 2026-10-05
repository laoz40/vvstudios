import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { requirePermission } from "#convex/services/auth";
import {
	getCustomInvoiceRow,
	listCustomInvoicesByBookingId,
	saveNumberedCustomInvoice,
	validateCustomTotalDueAmount
} from "#convex/lib/stripe/customInvoices";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";

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

export function listCustomInvoicesForBooking(ctx: QueryCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listCustomInvoicesByBookingId(ctx, args.bookingId)
	);
}

export function loadBookingCustomInvoiceInput(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; customInvoiceId: Id<"customInvoices"> }
) {
	return getCustomInvoiceRow(ctx, args.customInvoiceId).map((customInvoice) =>
		customInvoice?.bookingId === args.bookingId ? customInvoice : null
	);
}

export function createBookingCustomInvoiceFromAdmin(
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
