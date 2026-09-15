import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { z } from "zod";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import {
	DURATION_OPTIONS,
	packageFormSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildPackageInvoiceData,
	createPackageInvoiceLineItemSnapshot,
	createPriceAdjustmentInvoiceLineItem
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

export type CustomPackageInvoiceInput = {
	customInvoice: Doc<"customInvoices">;
	packageRecord: Doc<"packages">;
};

type CustomPackageFormData = z.infer<typeof packageFormSchema>;

function toCustomDuration(value: string | undefined): BookingFormValues["duration"] | "" {
	return DURATION_OPTIONS.find((duration) => duration === value) ?? "";
}

function resolveCustomInvoiceQuantity(
	customInvoice: Doc<"customInvoices">,
	packageRecord: Doc<"packages">,
	field:
		| "essentialEditQuantity"
		| "completeEditQuantity"
		| "clipsPackageQuantity"
		| "handcraftedClipsQuantity"
) {
	return customInvoice[field] ?? packageRecord[field] ?? "";
}

function parseCustomPackageInvoice(invoiceInput: CustomPackageInvoiceInput) {
	const { customInvoice, packageRecord } = invoiceInput;
	const packageSize = customInvoice.packageSize ?? packageRecord.packageSize;

	const parsedCustomInvoice = packageFormSchema.safeParse({
		name: packageRecord.name,
		phone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		email: packageRecord.email,
		duration: customInvoice.duration ?? packageRecord.duration,
		addons: customInvoice.addons,
		essentialEditQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"essentialEditQuantity"
		),
		completeEditQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"completeEditQuantity"
		),
		clipsPackageQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"clipsPackageQuantity"
		),
		handcraftedClipsQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"handcraftedClipsQuantity"
		),
		notes: packageRecord.notes ?? "",
		packageSize
	});

	if (!parsedCustomInvoice.success) {
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	return ok({ customInvoiceData: parsedCustomInvoice.data, packageSize });
}

function createCustomInvoiceLineItems(
	customInvoiceData: CustomPackageFormData,
	customDuration: BookingFormValues["duration"] | "",
	packageSize: number,
	amounts: ReturnType<typeof calculatePackageAmounts>,
	totalDueAmount: number
) {
	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		addons: customInvoiceData.addons,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
		completeEditQuantity: customInvoiceData.completeEditQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: customDuration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
		handcraftedClipsQuantity: customInvoiceData.handcraftedClipsQuantity || undefined,
		packageSize
	});

	const priceAdjustmentAmount = totalDueAmount - amounts.totalDueAmount;

	if (priceAdjustmentAmount !== 0) {
		invoiceLineItems.push(createPriceAdjustmentInvoiceLineItem(priceAdjustmentAmount));
	}

	return invoiceLineItems;
}

export function createCustomPackageInvoiceData(
	invoiceInput: CustomPackageInvoiceInput,
	leadTimeMinutes: number
): Result<ReturnType<typeof buildPackageInvoiceData>, { reason: "INVALID_BOOKING_DATA" }> {
	return parseCustomPackageInvoice(invoiceInput).map(({ customInvoiceData, packageSize }) => {
		// An omitted custom duration intentionally produces an add-ons-only invoice.
		const customDuration = toCustomDuration(invoiceInput.customInvoice.duration);

		const amounts = calculatePackageAmounts({
			...customInvoiceData,
			duration: customDuration,
			includeDiscount: invoiceInput.customInvoice.includePackageDiscount !== false,
			packageSize
		});

		const totalDueAmount =
			invoiceInput.customInvoice.customTotalDueAmount ?? amounts.totalDueAmount;

		const invoiceLineItems = createCustomInvoiceLineItems(
			customInvoiceData,
			customDuration,
			packageSize,
			amounts,
			totalDueAmount
		);

		const invoiceDueAt = invoiceInput.customInvoice.dueDate
			? new Date(`${invoiceInput.customInvoice.dueDate}T00:00:00`).getTime()
			: (invoiceInput.packageRecord.invoiceDueAt ?? invoiceInput.packageRecord.createdAt);

		return buildPackageInvoiceData({
			bookingId: invoiceInput.packageRecord._id,
			name: customInvoiceData.name,
			phone: customInvoiceData.phone,
			accountName: customInvoiceData.accountName,
			abn: customInvoiceData.abn,
			email: customInvoiceData.email,
			duration: customDuration || customInvoiceData.duration,
			addons: customInvoiceData.addons,
			essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
			completeEditQuantity: customInvoiceData.completeEditQuantity || undefined,
			clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
			handcraftedClipsQuantity: customInvoiceData.handcraftedClipsQuantity || undefined,
			createdAt: invoiceInput.customInvoice.createdAt,
			invoiceDueAt,
			invoiceNumber: invoiceInput.customInvoice.invoiceNumber,
			packageSize,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount,
			invoiceLineItems,
			leadTimeMinutes
		});
	});
}
