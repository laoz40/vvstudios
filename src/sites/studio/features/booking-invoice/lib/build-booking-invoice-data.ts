import { format } from "date-fns";
import {
	ADDON_PRICES,
	BOOKING_DEPOSIT_AMOUNT,
	BOOKING_INVOICE_BUSINESS,
	BOOKING_INVOICE_NOTES,
	BOOKING_INVOICE_PAYMENT,
	BOOKING_INVOICE_TITLE,
} from "#studio/features/booking-invoice/lib/constants";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type {
	BookingInvoiceBuilderInput,
	BookingInvoiceData,
	BookingInvoiceLineItem,
} from "#studio/features/booking-invoice/lib/types";

function formatCalendarDate(value: string) {
	return format(new Date(`${value}T00:00:00`), "d MMMM yyyy");
}

export function formatBookingInvoiceNumber(invoiceId: string, invoiceDate: number) {
	const datePart = format(invoiceDate, "yyyyMMdd");
	const suffix = String(invoiceId)
		.replace(/[^a-zA-Z0-9]/g, "")
		.toUpperCase()
		.slice(0, 4);

	return `VV-${datePart}-${suffix}`;
}

export function buildBookingInvoiceData(input: BookingInvoiceBuilderInput): BookingInvoiceData {
	const amounts = calculateBookingInvoiceAmounts({
		duration: input.duration,
		addons: input.addons,
		includeBaseAmount: Boolean(input.service),
		includeDepositLineItem: input.includeDepositLineItem !== false,
	});
	const bookingDateLabel = formatCalendarDate(input.date);
	const dueDate = input.dueDate ?? input.date;
	const invoiceDate = input.createdAt ?? Date.now();
	const invoiceDateLabel = format(invoiceDate, "d MMMM yyyy");
	const dueDateLabel = formatCalendarDate(dueDate);
	const addonsSummary =
		input.addons.length > 0
			? input.addons.map((addon) => `${addon} (${ADDON_PRICES[addon].toFixed(2)})`).join(", ")
			: "No add-ons selected";

	const lineItems: BookingInvoiceLineItem[] = [
		...(input.service
			? [
					{
						amount: amounts.baseAmount,
						description: `${input.service} Podcast Studio Hire (${input.duration})`,
						quantity: 1,
						rate: amounts.baseAmount,
					},
				]
			: []),
		...input.addons.map((addon) => ({
			amount: ADDON_PRICES[addon],
			description: addon,
			quantity: 1,
			rate: ADDON_PRICES[addon],
		})),
		...(input.includeDepositLineItem === false
			? []
			: [
					{
						amount: -BOOKING_DEPOSIT_AMOUNT,
						description: "Deposit paid",
						quantity: 1,
						rate: -BOOKING_DEPOSIT_AMOUNT,
					},
				]),
	];

	return {
		amounts,
		booking: {
			addons: input.addons,
			addonsSummary,
			bookingDate: input.date,
			bookingDateLabel,
			duration: input.duration,
			service: input.service,
			time: input.time,
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
			websiteUrl: BOOKING_INVOICE_BUSINESS.websiteUrl,
		},
		customer: {
			abn: input.abn,
			accountName: input.accountName,
			email: input.email,
			name: input.name,
			phone: input.phone,
		},
		invoice: {
			dueDate,
			dueDateLabel,
			invoiceDate: new Date(invoiceDate).toISOString(),
			invoiceDateLabel,
			number: input.invoiceNumber ?? formatBookingInvoiceNumber(input.bookingId, invoiceDate),
			title: BOOKING_INVOICE_TITLE,
		},
		lineItems,
		notes: {
			cancellationPolicy: BOOKING_INVOICE_NOTES.cancellationPolicy,
			paymentNote: BOOKING_INVOICE_NOTES.paymentNote,
		},
		payment: {
			accountNumber: BOOKING_INVOICE_PAYMENT.accountNumber,
			bankTransferLabel: BOOKING_INVOICE_PAYMENT.bankTransferLabel,
			bsb: BOOKING_INVOICE_PAYMENT.bsb,
			payId: BOOKING_INVOICE_PAYMENT.payId,
			payIdLabel: BOOKING_INVOICE_PAYMENT.payIdLabel,
		},
	};
}
