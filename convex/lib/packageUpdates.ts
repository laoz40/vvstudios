import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { packageFormSchema } from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	getPackageInvoiceDueAt,
	type PackageSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	createPackageInvoiceLineItemSnapshot,
	createPriceAdjustmentInvoiceLineItem
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { getPackageUpdateValidationError } from "#convex/lib/packageScheduling";

export type CreatePendingPackageArgs = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: BookingAddon[];
	notes?: string;
	packageSize: PackageSize;
	singleSessionAmount: number;
	packageSubtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalDueAmount: number;
	invoiceLineItems: Doc<"packages">["invoiceLineItems"];
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
	packageId: Id<"packages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: BookingAddon[];
	notes?: string;
	packageSize: PackageSize;
	expiresAt?: number;
	totalDueAmount?: number;
} & BookingAddonQuantitiesArgs;

type ParsedPackage = ReturnType<typeof packageFormSchema.parse>;

export type ParsedPackageRequest = ParsedPackage;

type PendingPackageRecord = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: BookingAddon[];
	essentialEditQuantity?: string;
	completeEditQuantity?: string;
	clipsPackageQuantity?: string;
	handcraftedClipsQuantity?: string;
	notes?: string;
	packageSize: PackageSize;
	singleSessionAmount: number;
	packageSubtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalDueAmount: number;
	invoiceLineItems: Doc<"packages">["invoiceLineItems"];
	status: "pending_payment";
	createdAt: number;
	invoiceDueAt: number;
	invoiceEmailStatus: "pending";
};

export function buildPendingPackageRecord(args: CreatePendingPackageArgs, createdAt: number) {
	const record: PendingPackageRecord = {
		name: args.name,
		phone: args.phone,
		accountName: args.accountName,
		email: args.email.trim().toLowerCase(),
		duration: args.duration,
		addons: args.addons,
		packageSize: args.packageSize,
		singleSessionAmount: args.singleSessionAmount,
		packageSubtotalAmount: args.packageSubtotalAmount,
		discountPercent: args.discountPercent,
		discountAmount: args.discountAmount,
		totalDueAmount: args.totalDueAmount,
		invoiceLineItems: args.invoiceLineItems,
		status: "pending_payment",
		createdAt,
		invoiceDueAt: getPackageInvoiceDueAt(createdAt),
		invoiceEmailStatus: "pending"
	};

	if (args.abn !== undefined) {
		record.abn = args.abn;
	}

	if (args.essentialEditQuantity !== undefined) {
		record.essentialEditQuantity = args.essentialEditQuantity;
	}

	if (args.completeEditQuantity !== undefined) {
		record.completeEditQuantity = args.completeEditQuantity;
	}

	if (args.clipsPackageQuantity !== undefined) {
		record.clipsPackageQuantity = args.clipsPackageQuantity;
	}

	if (args.handcraftedClipsQuantity !== undefined) {
		record.handcraftedClipsQuantity = args.handcraftedClipsQuantity;
	}

	if (args.notes !== undefined) {
		record.notes = args.notes;
	}

	return record;
}

export function parsePackageRequest(
	args: CreatePackageRequestArgs
): ResultAsync<ParsedPackageRequest, { reason: "BOOKING_INVALID_INPUT" }> {
	const parsedPackage = packageFormSchema.safeParse(args);

	if (!parsedPackage.success) {
		return errAsync({ reason: "BOOKING_INVALID_INPUT" as const });
	}

	return okAsync(parsedPackage.data);
}

export function parsePackageUpdate(args: UpdatePackageArgs) {
	const parsedPackage = packageFormSchema.safeParse({
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

type PackageUpdatePatch = {
	name: string;
	phone: string;
	accountName: string;
	abn: string | undefined;
	email: string;
	duration: ParsedPackage["duration"];
	addons: ParsedPackage["addons"];
	essentialEditQuantity: ParsedPackage["essentialEditQuantity"];
	completeEditQuantity: ParsedPackage["completeEditQuantity"];
	clipsPackageQuantity: ParsedPackage["clipsPackageQuantity"];
	handcraftedClipsQuantity: ParsedPackage["handcraftedClipsQuantity"];
	notes: ParsedPackage["notes"];
	packageSize: ParsedPackage["packageSize"];
	expiresAt?: number;
	singleSessionAmount: number;
	packageSubtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalDueAmount: number;
	invoiceLineItems: Doc<"packages">["invoiceLineItems"];
};

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

	const patch: PackageUpdatePatch = {
		name: updatedPackage.name,
		phone: updatedPackage.phone,
		accountName: updatedPackage.accountName,
		abn: updatedPackage.abn,
		email: updatedPackage.email.trim().toLowerCase(),
		duration: updatedPackage.duration,
		addons: updatedPackage.addons,
		essentialEditQuantity: updatedPackage.essentialEditQuantity,
		completeEditQuantity: updatedPackage.completeEditQuantity,
		clipsPackageQuantity: updatedPackage.clipsPackageQuantity,
		handcraftedClipsQuantity: updatedPackage.handcraftedClipsQuantity,
		notes: updatedPackage.notes,
		packageSize: updatedPackage.packageSize,
		singleSessionAmount: amounts.singleSessionAmount,
		packageSubtotalAmount: amounts.packageSubtotalAmount,
		discountPercent: amounts.discountPercent,
		discountAmount: amounts.discountAmount,
		totalDueAmount,
		invoiceLineItems
	};

	if (args.expiresAt !== undefined) {
		patch.expiresAt = args.expiresAt;
	}

	return patch;
}
