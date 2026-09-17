import type { Doc } from "#convex/_generated/dataModel";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	formatCustomInvoiceAddonText,
	formatCustomInvoiceTotal
} from "#studio/features/admin/lib/custom-invoices";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import {
	pickBookingAddonQuantities,
	SERVICES
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

type CustomInvoiceRecord = Doc<"customInvoices">;

function isBookingService(value: string | undefined): value is BookingService {
	return SERVICES.some((service) => service === value);
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
