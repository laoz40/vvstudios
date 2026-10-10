import type { Id } from "#convex/_generated/dataModel";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import type { BookingAddon } from "#/domain/booking/catalog";
import { requirePermission } from "#convex/shared/services/auth";
import {
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

function listCustomInvoicesForBookingId(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return listCustomInvoicesByBookingId(ctx, bookingId);
}

export function listCustomInvoicesForBooking(ctx: QueryCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listCustomInvoicesForBookingId(ctx, args.bookingId)
	);
}

function customInvoiceForBooking(
	bookingId: Id<"bookings">,
	customInvoice: Doc<"customInvoices"> | null
) {
	return customInvoice?.bookingId === bookingId ? customInvoice : null;
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

function keepIdentity(identity: StaffIdentity) {
	return identity;
}

function validateCustomTotalDueAmountForArgs(
	args: CreateBookingCustomInvoiceArgs,
	identity: StaffIdentity
) {
	return validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => keepIdentity(identity));
}

function loadSessionForCustomInvoiceArgs(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs,
	identity: StaffIdentity
) {
	return getSessionFromDb(ctx, args.bookingId).map(() => keepIdentity(identity));
}

function toCreatedCustomInvoiceResult(
	customInvoiceId: Id<"customInvoices">,
	invoiceNumber: string,
	createdAt: number
) {
	return { customInvoiceId, invoiceNumber, createdAt };
}

function numberCustomInvoiceAfterInsert(
	ctx: MutationCtx,
	{ customInvoiceId, createdAt }: { customInvoiceId: Id<"customInvoices">; createdAt: number }
) {
	const invoiceNumber = formatBookingInvoiceNumber(customInvoiceId, createdAt);

	return patchCustomInvoiceNumber(ctx, customInvoiceId, invoiceNumber).map(() =>
		toCreatedCustomInvoiceResult(customInvoiceId, invoiceNumber, createdAt)
	);
}

function insertCustomInvoiceFromAdminIdentity(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs,

	identity: StaffIdentity
) {
	return insertPendingCustomInvoice(ctx, {
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
	}).andThen((_value) => numberCustomInvoiceAfterInsert(ctx, _value));
}

export function createBookingCustomInvoiceFromAdmin(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return requirePermission(ctx, "create:invoices")
		.andThen((identity: StaffIdentity) => validateCustomTotalDueAmountForArgs(args, identity))
		.andThen((identity: StaffIdentity) => loadSessionForCustomInvoiceArgs(ctx, args, identity))
		.andThen((identity: StaffIdentity) =>
			insertCustomInvoiceFromAdminIdentity(ctx, args, identity)
		);
}
