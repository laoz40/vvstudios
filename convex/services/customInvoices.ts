import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getAdminIdentityResult } from "#convex/lib/auth";
import {
	saveNumberedCustomInvoice,
	validateCustomTotalDueAmount
} from "#convex/lib/customInvoices";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import { getSessionFromDbResult } from "#convex/lib/sessionLookup";

type CustomInvoiceDetails = {
	dueDate?: string;
	duration?: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	includeDepositLineItem: boolean;
	customTotalDueAmount?: number;
};

export type CreateBookingCustomInvoiceArgs = CustomInvoiceDetails & {
	bookingId: Id<"bookings">;
	service?: string;
};

export type CreatePackageCustomInvoiceArgs = CustomInvoiceDetails & {
	multiBookingId: Id<"multiBookingPackages">;
	packageSize: 4 | 8 | 12;
	includePackageDiscount?: boolean;
};

export function createBookingCustomInvoiceService(
	ctx: MutationCtx,
	args: CreateBookingCustomInvoiceArgs
) {
	return (
		getAdminIdentityResult(ctx)
			// Validate the optional price override before loading or writing invoice data.
			.andThen((identity) =>
				validateCustomTotalDueAmount(args.customTotalDueAmount).map(() => identity)
			)
			// Confirm the session still exists before creating its custom invoice.
			.andThen((identity) => getSessionFromDbResult(ctx, args.bookingId).map(() => identity))
			// Save and number the invoice in the same transaction.
			.andThen((identity) =>
				saveNumberedCustomInvoice(ctx, {
					bookingId: args.bookingId,
					dueDate: args.dueDate,
					service: args.service,
					duration: args.duration,
					addons: args.addons,
					essentialEditQuantity: args.essentialEditQuantity,
					clipsPackageQuantity: args.clipsPackageQuantity,
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
		getAdminIdentityResult(ctx)
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
					clipsPackageQuantity: args.clipsPackageQuantity,
					packageSize: args.packageSize,
					includeDepositLineItem: args.includeDepositLineItem,
					includePackageDiscount: args.includePackageDiscount,
					customTotalDueAmount: args.customTotalDueAmount,
					createdBy: identity.email
				})
			)
	);
}
