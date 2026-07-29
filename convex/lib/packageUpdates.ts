import { err, ok } from "neverthrow";
import { multiBookingFormSchema } from "../../src/sites/studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	type MultiBookingSize
} from "../../src/sites/studio/features/booking-form/lib/booking-pricing";
import { createPackageInvoiceLineItemSnapshot } from "../../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Id } from "../_generated/dataModel";
import { getPackageUpdateValidationError } from "./packageScheduling";

export type UpdatePackageArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	packageSize: MultiBookingSize;
	expiresAt?: number;
	totalDueAmount?: number;
};

type ParsedPackage = ReturnType<typeof multiBookingFormSchema.parse>;

export function parsePackageUpdate(args: UpdatePackageArgs) {
	const parsedPackage = multiBookingFormSchema.safeParse({
		...args,
		essentialEditQuantity: args.essentialEditQuantity ?? "",
		clipsPackageQuantity: args.clipsPackageQuantity ?? "",
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
	const amounts = calculatePackageAmounts({
		addons: updatedPackage.addons,
		clipsPackageQuantity: updatedPackage.clipsPackageQuantity,
		duration: updatedPackage.duration,
		essentialEditQuantity: updatedPackage.essentialEditQuantity,
		packageSize: updatedPackage.packageSize
	});
	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		addons: updatedPackage.addons,
		clipsPackageQuantity: updatedPackage.clipsPackageQuantity,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: updatedPackage.duration,
		essentialEditQuantity: updatedPackage.essentialEditQuantity,
		packageSize: updatedPackage.packageSize
	});

	return {
		name: updatedPackage.name,
		phone: updatedPackage.phone,
		accountName: updatedPackage.accountName,
		abn: updatedPackage.abn,
		email: updatedPackage.email,
		duration: updatedPackage.duration,
		addons: updatedPackage.addons,
		essentialEditQuantity: updatedPackage.essentialEditQuantity,
		clipsPackageQuantity: updatedPackage.clipsPackageQuantity,
		notes: updatedPackage.notes,
		packageSize: updatedPackage.packageSize,
		...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
		singleSessionAmount: amounts.singleSessionAmount,
		packageSubtotalAmount: amounts.packageSubtotalAmount,
		discountPercent: amounts.discountPercent,
		discountAmount: amounts.discountAmount,
		totalDueAmount: args.totalDueAmount ?? amounts.totalDueAmount,
		invoiceLineItems
	};
}
