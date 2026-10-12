import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
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

export function listCustomInvoicesForBooking(ctx: QueryCtx, args: { bookingId: Id<"bookings"> }) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "view:sensitive-booking-data");
		const invoices = yield* listCustomInvoicesByBookingId(ctx, args.bookingId);

		return ok(invoices);
	});
}

export function loadBookingCustomInvoiceInput(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; customInvoiceId: Id<"customInvoices"> }
) {
	return safeTry(async function* () {
		const invoice = yield* getCustomInvoiceRow(ctx, args.customInvoiceId);
		const bookingInvoice = customInvoiceForBooking(args.bookingId, invoice);

		return ok(bookingInvoice);
	});
}

export function createBookingCustomInvoiceFromAdmin(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "create:invoices");
		yield* validateCustomTotalDueAmount(args.customTotalDueAmount);
		yield* getSessionFromDb(ctx, args.bookingId);

		const { customInvoiceId, createdAt } = yield* insertPendingCustomInvoice(ctx, {
			...args,
			createdBy: identity.email
		});

		const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);
		yield* patchCustomInvoiceNumber(ctx, customInvoiceId, invoiceNumber);

		return ok({ customInvoiceId, invoiceNumber, createdAt });
	});
}
