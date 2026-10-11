import type { Id } from "#convex/_generated/dataModel";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import type { BookingAddon } from "#/domain/booking/catalog";
import { requirePermission } from "#convex/shared/services/auth";
import {
	customInvoiceForBooking,
	getCustomInvoiceRow,
	insertPendingCustomInvoice,
	listCustomInvoicesByBookingId,
	patchCustomInvoiceNumber,
	validateCustomTotalDueAmount
} from "#convex/stripe/lib/customInvoices";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { getSessionFromDb } from "#convex/sessions/services/lookup";

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

type StaffIdentity = { email?: string };

export function listCustomInvoicesForBooking(ctx: QueryCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listCustomInvoicesByBookingId(ctx, args.bookingId)
	);
}

export function loadBookingCustomInvoiceInput(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; customInvoiceId: Id<"customInvoices"> }
) {
	return getCustomInvoiceRow(ctx, args.customInvoiceId).map(
		(customInvoice: Doc<"customInvoices"> | null) =>
			customInvoiceForBooking(args.bookingId, customInvoice)
	);
}

export function createBookingCustomInvoiceFromAdmin(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return requirePermission(ctx, "create:invoices")
		.andThen((identity: StaffIdentity) =>
			validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => identity)
		)
		.andThen((identity: StaffIdentity) => getSessionFromDb(ctx, args.bookingId).map(() => identity))
		.andThen((identity: StaffIdentity) =>
			insertPendingCustomInvoice(ctx, { ...args, createdBy: identity.email }).andThen(
				({ customInvoiceId, createdAt }) => {
					const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

					return patchCustomInvoiceNumber(ctx, customInvoiceId, invoiceNumber).map(() => ({
						customInvoiceId,
						invoiceNumber,
						createdAt
					}));
				}
			)
		);
}
