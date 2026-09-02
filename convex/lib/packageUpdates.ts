import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { multiBookingFormSchema } from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	getMultiBookingInvoiceDueAt,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	createPackageInvoiceLineItemSnapshot,
	createPriceAdjustmentInvoiceLineItem
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { getPackageUpdateValidationError } from "./packageScheduling";

export type CreatePendingPackageArgs = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: string[];
	notes?: string;
	packageSize: MultiBookingSize;
	singleSessionAmount: number;
	packageSubtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalDueAmount: number;
	invoiceLineItems: Doc<"multiBookingPackages">["invoiceLineItems"];
} & BookingAddonQuantitiesArgs;

export type CreatePackageRequestArgs = Omit<
	CreatePendingPackageArgs,
	| "singleSessionAmount"
	| "packageSubtotalAmount"
	| "discountPercent"
	| "discountAmount"
	| "totalDueAmount"
	| "invoiceLineItems"
>;

export type UpdatePackageArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: string[];
	notes?: string;
	packageSize: MultiBookingSize;
	expiresAt?: number;
	totalDueAmount?: number;
} & BookingAddonQuantitiesArgs;

type ParsedPackage = ReturnType<typeof multiBookingFormSchema.parse>;
export type ParsedPackageRequest = ParsedPackage;

export function buildPendingPackageRecord(args: CreatePendingPackageArgs, createdAt: number) {
	return {
		name: args.name,
		phone: args.phone,
		accountName: args.accountName,
		...(args.abn !== undefined ? { abn: args.abn } : {}),
		email: args.email,
		duration: args.duration,
		addons: args.addons,
		...(args.essentialEditQuantity !== undefined
			? { essentialEditQuantity: args.essentialEditQuantity }
			: {}),
		...(args.completeEditQuantity !== undefined
			? { completeEditQuantity: args.completeEditQuantity }
			: {}),
		...(args.clipsPackageQuantity !== undefined
			? { clipsPackageQuantity: args.clipsPackageQuantity }
			: {}),
		...(args.handcraftedClipsQuantity !== undefined
			? { handcraftedClipsQuantity: args.handcraftedClipsQuantity }
			: {}),
		...(args.notes !== undefined ? { notes: args.notes } : {}),
		packageSize: args.packageSize,
		singleSessionAmount: args.singleSessionAmount,
		packageSubtotalAmount: args.packageSubtotalAmount,
		discountPercent: args.discountPercent,
		discountAmount: args.discountAmount,
		totalDueAmount: args.totalDueAmount,
		invoiceLineItems: args.invoiceLineItems,
		status: "pending_payment" as const,
		createdAt,
		invoiceDueAt: getMultiBookingInvoiceDueAt(createdAt),
		invoiceEmailStatus: "pending" as const
	};
}

export function parsePackageRequest(
	args: CreatePackageRequestArgs
): ResultAsync<ParsedPackageRequest, { reason: "BOOKING_INVALID_INPUT" }> {
	const parsedPackage = multiBookingFormSchema.safeParse(args);

	if (!parsedPackage.success) {
		return errAsync({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	return okAsync(parsedPackage.data);
}

export function parsePackageUpdate(args: UpdatePackageArgs) {
	const parsedPackage = multiBookingFormSchema.safeParse({
		...args,
		essentialEditQuantity: args.essentialEditQuantity ?? "",
		completeEditQuantity: args.completeEditQuantity ?? "",
		clipsPackageQuantity: args.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity: args.handcraftedClipsQuantity ?? "",
		notes: args.notes ?? ""
	});

	if (!parsedPackage.success) {
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	return ok(parsedPackage.data);
}

export function validatePackageUpdate(
	args: UpdatePackageArgs,
	updatedPackage: ParsedPackage,
	activeBookedSessionCount: number
) {
	const validationError = getPackageUpdateValidationError(
		args,
		activeBookedSessionCount,
		updatedPackage.packageSize
	);

	if (validationError !== null) {
		return err({ reason: validationError });
	}

	return ok(updatedPackage);
}

export function buildPackageUpdatePatch(args: UpdatePackageArgs, updatedPackage: ParsedPackage) {
	const amounts = calculatePackageAmounts(updatedPackage);
	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		...updatedPackage,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent
	});
	const totalDueAmount = args.totalDueAmount ?? amounts.totalDueAmount;
	const priceAdjustmentAmount = totalDueAmount - amounts.totalDueAmount;

	if (priceAdjustmentAmount !== 0) {
		invoiceLineItems.push(createPriceAdjustmentInvoiceLineItem(priceAdjustmentAmount));
	}

	return {
		name: updatedPackage.name,
		phone: updatedPackage.phone,
		accountName: updatedPackage.accountName,
		abn: updatedPackage.abn,
		email: updatedPackage.email,
		duration: updatedPackage.duration,
		addons: updatedPackage.addons,
		essentialEditQuantity: updatedPackage.essentialEditQuantity,
		completeEditQuantity: updatedPackage.completeEditQuantity,
		clipsPackageQuantity: updatedPackage.clipsPackageQuantity,
		handcraftedClipsQuantity: updatedPackage.handcraftedClipsQuantity,
		notes: updatedPackage.notes,
		packageSize: updatedPackage.packageSize,
		...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
		singleSessionAmount: amounts.singleSessionAmount,
		packageSubtotalAmount: amounts.packageSubtotalAmount,
		discountPercent: amounts.discountPercent,
		discountAmount: amounts.discountAmount,
		totalDueAmount,
		invoiceLineItems
	};
}
