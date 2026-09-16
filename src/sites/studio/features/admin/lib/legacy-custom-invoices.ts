import type { Doc } from "#convex/_generated/dataModel";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	formatCustomInvoiceAddonText,
	formatCustomInvoiceCurrency,
	formatCustomInvoiceTotal
} from "#studio/features/admin/lib/custom-invoices";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import {
	pickBookingAddonQuantities,
	SERVICES,
	toDeliverableCountOption,
	type BookingAddon,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	type PackageSize
} from "#studio/features/booking-form/lib/booking-pricing";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

type CustomInvoiceRecord = Doc<"customInvoices">;

function isBookingService(value: string | undefined): value is BookingService {
	return SERVICES.some((service) => service === value);
}

function formatPackageInvoiceTotal(
	input: {
		addons: readonly BookingAddon[];
		customTotalDueAmount?: number;
		duration: BookingFormValues["duration"] | "";
		packageSize: PackageSize;
		includePackageDiscount: boolean;
	} & ReturnType<typeof pickBookingAddonQuantities>
) {
	if (input.customTotalDueAmount !== undefined) {
		return formatCustomInvoiceCurrency(input.customTotalDueAmount);
	}

	return formatCustomInvoiceCurrency(
		calculatePackageAmounts({
			addons: [...input.addons],
			duration: input.duration,
			packageSize: input.packageSize,
			includeDiscount: input.includePackageDiscount,
			...pickBookingAddonQuantities(input)
		}).totalDueAmount
	);
}

export function mapSessionCustomInvoicesToListItems(
	customInvoices: CustomInvoiceRecord[],
	session: SessionRecord
): PreviousCustomInvoiceItem[] {
	return customInvoices.map((invoice) => {
		const addonQuantities = pickBookingAddonQuantities({
			clipsPackageQuantity: invoice.clipsPackageQuantity ?? session.clipsPackageQuantity,
			completeEditQuantity: invoice.completeEditQuantity ?? session.completeEditQuantity,
			essentialEditQuantity: invoice.essentialEditQuantity ?? session.essentialEditQuantity,
			handcraftedClipsQuantity: invoice.handcraftedClipsQuantity ?? session.handcraftedClipsQuantity
		});

		const addonText = formatCustomInvoiceAddonText({ addons: invoice.addons, ...addonQuantities });

		return {
			id: invoice._id,
			invoiceNumber: invoice.invoiceNumber,
			description: `${invoice.service ?? "Add-ons only"}${addonText}`,
			total: formatCustomInvoiceTotal({
				service: invoice.service,
				addons: invoice.addons,
				duration: invoice.duration ?? "",
				includeDepositLineItem: invoice.includeDepositLineItem,
				...addonQuantities,
				customTotalDueAmount: invoice.customTotalDueAmount
			})
		};
	});
}

export function mapPackageCustomInvoicesToListItems(
	customInvoices: CustomInvoiceRecord[],
	packageRow: AdminPackageRow
): PreviousCustomInvoiceItem[] {
	return customInvoices.map((invoice) => {
		const addonQuantities = pickBookingAddonQuantities({
			clipsPackageQuantity: toDeliverableCountOption(
				invoice.clipsPackageQuantity ?? packageRow.clipsPackageQuantity
			),
			completeEditQuantity: toDeliverableCountOption(
				invoice.completeEditQuantity ?? packageRow.completeEditQuantity
			),
			essentialEditQuantity: toDeliverableCountOption(
				invoice.essentialEditQuantity ?? packageRow.essentialEditQuantity
			),
			handcraftedClipsQuantity: toDeliverableCountOption(
				invoice.handcraftedClipsQuantity ?? packageRow.handcraftedClipsQuantity
			)
		});

		const addonText = formatCustomInvoiceAddonText({ addons: invoice.addons, ...addonQuantities });
		const packageSize = invoice.packageSize ?? packageRow.packageSize;
		const duration = invoice.duration ?? "Add-ons only";

		return {
			id: invoice._id,
			invoiceNumber: invoice.invoiceNumber,
			description: `${packageSize} sessions · ${duration}${addonText}`,
			total: formatPackageInvoiceTotal({
				addons: invoice.addons,
				customTotalDueAmount: invoice.customTotalDueAmount,
				duration: toAdminSessionDuration(invoice.duration),
				includePackageDiscount: invoice.includePackageDiscount !== false,
				packageSize,
				...addonQuantities
			})
		};
	});
}

export async function downloadSessionCustomInvoice(input: {
	customInvoice: CustomInvoiceRecord;
	leadTimeMinutes: number;
	session: SessionRecord;
}): Promise<DownloadAdminBookingInvoiceResult> {
	return downloadAdminBookingInvoice({
		session: input.session,
		addons: [...input.customInvoice.addons],
		createdAt: input.customInvoice.createdAt,
		...pickBookingAddonQuantities({
			clipsPackageQuantity:
				input.customInvoice.clipsPackageQuantity ?? input.session.clipsPackageQuantity,
			completeEditQuantity:
				input.customInvoice.completeEditQuantity ?? input.session.completeEditQuantity,
			essentialEditQuantity:
				input.customInvoice.essentialEditQuantity ?? input.session.essentialEditQuantity,
			handcraftedClipsQuantity:
				input.customInvoice.handcraftedClipsQuantity ?? input.session.handcraftedClipsQuantity
		}),
		dueDate: input.customInvoice.dueDate,
		duration: input.customInvoice.duration
			? toAdminSessionDuration(input.customInvoice.duration)
			: undefined,
		includeDepositLineItem: input.customInvoice.includeDepositLineItem,
		invoiceNumber: input.customInvoice.invoiceNumber,
		leadTimeMinutes: input.leadTimeMinutes,
		service:
			isBookingService(input.customInvoice.service) && input.customInvoice.duration
				? input.customInvoice.service
				: null,
		customTotalDueAmount: input.customInvoice.customTotalDueAmount
	});
}
