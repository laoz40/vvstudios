import { format } from "date-fns";
import { ADDON_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import {
	getCustomerAddonDisplayLabel,
	pickBookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	BOOKING_INVOICE_BUSINESS,
	BOOKING_INVOICE_NOTES,
	BOOKING_RECEIPT_NOTES,
	BOOKING_RECEIPT_TITLE
} from "#studio/features/booking-invoice/lib/constants";
import {
	calculateBookingReceiptAmounts,
	getAddonAmount,
	getAddonQuantity
} from "#studio/features/booking-invoice/lib/calculate-booking-receipt-amounts";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type {
	BookingInvoiceLineItem,
	BookingReceiptBuilderInput,
	BookingReceiptData,
	PackageAdjustmentReceiptBuilderInput,
	PackageReceiptBuilderInput
} from "#studio/features/booking-invoice/lib/types";

function formatCalendarDate(value: string) {
	return format(new Date(`${value}T00:00:00`), "d MMMM yyyy");
}

export function buildBookingReceiptData(input: BookingReceiptBuilderInput): BookingReceiptData {
	const amounts = calculateBookingReceiptAmounts({
		duration: input.duration,
		addons: input.addons,
		...pickBookingAddonQuantities(input),
		includeBaseAmount: Boolean(input.service)
	});

	const bookingDateLabel = formatCalendarDate(input.date);
	const receiptDate = input.createdAt ?? Date.now();
	const receiptDateLabel = format(receiptDate, "d MMMM yyyy");
	const addonQuantities = pickBookingAddonQuantities(input);

	const addonsSummary =
		input.addons.length > 0
			? input.addons
					.map((addon) => {
						const quantity = getAddonQuantity(addon, addonQuantities);
						const quantityLabel = quantity > 1 ? ` x ${quantity}` : "";
						const displayLabel = getCustomerAddonDisplayLabel(addon);

						return `${displayLabel}${quantityLabel}`;
					})
					.join(", ")
			: "No add-ons selected";

	const lineItems: BookingInvoiceLineItem[] = [
		...(input.service
			? [
					{
						amount: amounts.baseAmount,
						description: `${input.service} Podcast Studio Hire (${input.duration})`,
						quantity: 1,
						rate: amounts.baseAmount
					}
				]
			: []),
		...input.addons.map((addon) => ({
			amount: getAddonAmount(addon, addonQuantities),
			description: getCustomerAddonDisplayLabel(addon),
			quantity: getAddonQuantity(addon, addonQuantities),
			rate: ADDON_PRICES[addon]
		}))
	];

	const noticeWindowLabel = formatNoticeWindowLabel(input.leadTimeMinutes);

	return {
		kind: "booking",
		amounts,
		booking: {
			addons: input.addons,
			addonsSummary,
			bookingDate: input.date,
			bookingDateLabel,
			duration: input.duration,
			service: input.service,
			time: input.time
		},
		branding: {
			businessName: BOOKING_INVOICE_BUSINESS.businessName,
			contactEmail: BOOKING_INVOICE_BUSINESS.contactEmail,
			locationAddress: BOOKING_INVOICE_BUSINESS.locationAddress,
			locationLabel: BOOKING_INVOICE_BUSINESS.locationLabel,
			locationUrl: BOOKING_INVOICE_BUSINESS.locationUrl,
			logoUrl: BOOKING_INVOICE_BUSINESS.logoUrl,
			ownerName: BOOKING_INVOICE_BUSINESS.ownerName,
			websiteLabel: BOOKING_INVOICE_BUSINESS.websiteLabel,
			websiteUrl: BOOKING_INVOICE_BUSINESS.websiteUrl
		},
		customer: {
			abn: input.abn,
			accountName: input.accountName,
			email: input.email,
			name: input.name,
			phone: input.phone
		},
		lineItems,
		notes: { cancellationPolicy: BOOKING_RECEIPT_NOTES.getCancellationPolicy(noticeWindowLabel) },
		receipt: {
			number: input.receiptNumber ?? formatBookingInvoiceNumber(input.bookingId, receiptDate),
			receiptDate: new Date(receiptDate).toISOString(),
			receiptDateLabel,
			title: BOOKING_RECEIPT_TITLE
		},
		rescheduleUrl: input.rescheduleUrl
	};
}

export function buildPackageReceiptData(input: PackageReceiptBuilderInput): BookingReceiptData {
	const addonQuantities = pickBookingAddonQuantities(input);
	const receiptDateLabel = format(input.paidAt, "d MMMM yyyy");
	const noticeWindowLabel = formatNoticeWindowLabel(input.leadTimeMinutes);

	const addonsSummary =
		input.addons.length > 0
			? input.addons
					.map((addon) => {
						const quantity = getAddonQuantity(addon, addonQuantities);
						const quantityLabel = quantity > 1 ? ` x ${quantity}` : "";
						const displayLabel = getCustomerAddonDisplayLabel(addon);

						return `${displayLabel}${quantityLabel}`;
					})
					.join(", ")
			: "No add-ons selected";

	return {
		kind: "package",
		amounts: {
			addonsAmount: 0,
			baseAmount: input.packageSubtotalAmount,
			currency: "AUD",
			subtotalAmount: input.packageSubtotalAmount,
			totalPaidAmount: input.totalDueAmount
		},
		booking: {
			addons: input.addons,
			addonsSummary,
			bookingDate: "unscheduled",
			bookingDateLabel: "To be scheduled after payment",
			duration: input.duration,
			time: "To be scheduled"
		},
		branding: {
			businessName: BOOKING_INVOICE_BUSINESS.businessName,
			contactEmail: BOOKING_INVOICE_BUSINESS.contactEmail,
			locationAddress: BOOKING_INVOICE_BUSINESS.locationAddress,
			locationLabel: BOOKING_INVOICE_BUSINESS.locationLabel,
			locationUrl: BOOKING_INVOICE_BUSINESS.locationUrl,
			logoUrl: BOOKING_INVOICE_BUSINESS.logoUrl,
			ownerName: BOOKING_INVOICE_BUSINESS.ownerName,
			websiteLabel: BOOKING_INVOICE_BUSINESS.websiteLabel,
			websiteUrl: BOOKING_INVOICE_BUSINESS.websiteUrl
		},
		customer: {
			abn: input.abn,
			accountName: input.accountName,
			email: input.email,
			name: input.name,
			phone: input.phone
		},
		lineItems: input.invoiceLineItems,
		notes: {
			cancellationPolicy: BOOKING_INVOICE_NOTES.getPackageCancellationPolicy(noticeWindowLabel)
		},
		package: { size: input.packageSize },
		receipt: {
			number: input.receiptNumber ?? formatBookingInvoiceNumber(input.packageId, input.paidAt),
			receiptDate: new Date(input.paidAt).toISOString(),
			receiptDateLabel,
			title: BOOKING_RECEIPT_TITLE
		}
	};
}

export function buildPackageAdjustmentReceiptData(
	input: PackageAdjustmentReceiptBuilderInput
): BookingReceiptData {
	const receiptDateLabel = format(input.paidAt, "d MMMM yyyy");
	const noticeWindowLabel = formatNoticeWindowLabel(input.leadTimeMinutes);
	const remotePodcastLabel = getCustomerAddonDisplayLabel("Remote Podcast");

	const lineItems: BookingInvoiceLineItem[] = [
		{
			description: `${remotePodcastLabel} (package adjustment)`,
			quantity: input.quantity,
			rate: input.rate,
			amount: input.totalAmount
		}
	];

	return {
		kind: "adjustment",
		adjustment: {
			bookedAtLabel: format(input.bookedAt, "d MMMM yyyy"),
			packageSize: input.packageSize
		},
		amounts: {
			addonsAmount: input.totalAmount,
			baseAmount: 0,
			currency: "AUD",
			subtotalAmount: input.totalAmount,
			totalPaidAmount: input.totalAmount
		},
		booking: {
			addons: ["Remote Podcast"],
			addonsSummary: `${input.quantity} completed Remote Podcast ${input.quantity === 1 ? "session" : "sessions"}`,
			bookingDate: "completed-package-sessions",
			bookingDateLabel: "Completed package sessions",
			duration: input.duration,
			time: "Not applicable"
		},
		branding: {
			businessName: BOOKING_INVOICE_BUSINESS.businessName,
			contactEmail: BOOKING_INVOICE_BUSINESS.contactEmail,
			locationAddress: BOOKING_INVOICE_BUSINESS.locationAddress,
			locationLabel: BOOKING_INVOICE_BUSINESS.locationLabel,
			locationUrl: BOOKING_INVOICE_BUSINESS.locationUrl,
			logoUrl: BOOKING_INVOICE_BUSINESS.logoUrl,
			ownerName: BOOKING_INVOICE_BUSINESS.ownerName,
			websiteLabel: BOOKING_INVOICE_BUSINESS.websiteLabel,
			websiteUrl: BOOKING_INVOICE_BUSINESS.websiteUrl
		},
		customer: {
			abn: input.abn,
			accountName: input.accountName,
			email: input.email,
			name: input.name,
			phone: input.phone
		},
		lineItems,
		notes: {
			cancellationPolicy: BOOKING_INVOICE_NOTES.getPackageCancellationPolicy(noticeWindowLabel)
		},
		receipt: {
			number: input.receiptNumber,
			receiptDate: new Date(input.paidAt).toISOString(),
			receiptDateLabel,
			title: BOOKING_RECEIPT_TITLE
		}
	};
}
