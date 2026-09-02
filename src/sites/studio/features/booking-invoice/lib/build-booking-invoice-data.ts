import { format } from "date-fns";
import {
	ADDON_PRICES,
	BOOKING_INVOICE_CURRENCY,
	DURATION_PRICES
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	BOOKING_DEPOSIT_AMOUNT,
	BOOKING_INVOICE_BUSINESS,
	BOOKING_INVOICE_NOTES,
	BOOKING_INVOICE_PAYMENT,
	BOOKING_INVOICE_TITLE
} from "#studio/features/booking-invoice/lib/constants";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	calculateBookingInvoiceAmounts,
	getAddonAmount,
	getAddonQuantity
} from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type {
	BookingInvoiceBuilderInput,
	BookingInvoiceData,
	BookingInvoiceLineItem
} from "#studio/features/booking-invoice/lib/types";

function formatCalendarDate(value: string) {
	return format(new Date(`${value}T00:00:00`), "d MMMM yyyy");
}

export function formatBookingInvoiceNumber(invoiceId: string, invoiceDate: number) {
	const datePart = format(invoiceDate, "yyyyMMdd");
	const suffix = invoiceId
		.replace(/[^a-zA-Z0-9]/g, "")
		.toUpperCase()
		.slice(-4);

	return `VV-${datePart}-${suffix}`;
}

function buildMultiBookingInvoiceLineItems(input: {
	addonLineItems: BookingInvoiceLineItem[];
	baseSessionAmount: number;
	discountAmount: number;
	discountPercent: number;
	duration?: BookingInvoiceBuilderInput["duration"];
	packageSize: number;
}): BookingInvoiceLineItem[] {
	const baseLineItems = input.duration
		? [
				{
					amount: input.baseSessionAmount * input.packageSize,
					description: `Studio Hire (${input.duration})`,
					quantity: input.packageSize,
					rate: input.baseSessionAmount
				}
			]
		: [];

	const discountLineItems =
		input.discountAmount > 0
			? [
					{
						amount: -input.discountAmount,
						description: `${input.discountPercent}% package discount`,
						quantity: 1,
						rate: -input.discountAmount
					}
				]
			: [];

	return [...baseLineItems, ...input.addonLineItems, ...discountLineItems];
}

export function createPriceAdjustmentInvoiceLineItem(amount: number): BookingInvoiceLineItem {
	return { amount, description: "Price adjustment", quantity: 1, rate: amount };
}

export function createPackageInvoiceLineItemSnapshot(
	input: {
		addons: BookingInvoiceBuilderInput["addons"];
		discountAmount: number;
		discountPercent: number;
		duration: BookingInvoiceBuilderInput["duration"] | "";
		packageSize: number;
	} & BookingAddonQuantities
): BookingInvoiceLineItem[] {
	const addonQuantities = pickBookingAddonQuantities(input);
	const addonLineItems = input.addons.map((addon) => {
		const quantityPerSession = getAddonQuantity(addon, addonQuantities);
		const totalQuantity = input.packageSize * quantityPerSession;

		return {
			amount: getAddonAmount(addon, addonQuantities) * input.packageSize,
			description: `${addon} add-on`,
			quantity: totalQuantity,
			rate: ADDON_PRICES[addon]
		};
	});

	return buildMultiBookingInvoiceLineItems({
		addonLineItems,
		baseSessionAmount: input.duration ? DURATION_PRICES[input.duration] : 0,
		discountAmount: input.discountAmount,
		discountPercent: input.discountPercent,
		duration: input.duration || undefined,
		packageSize: input.packageSize
	});
}

export function createStoredAmountMultiBookingInvoiceLineItemSnapshot(input: {
	discountAmount: number;
	discountPercent: number;
	duration: BookingInvoiceBuilderInput["duration"];
	packageSize: number;
	packageSubtotalAmount: number;
	singleSessionAmount: number;
}): BookingInvoiceLineItem[] {
	return [
		{
			amount: input.packageSubtotalAmount,
			description: `Studio Hire (${input.duration})`,
			quantity: input.packageSize,
			rate: input.singleSessionAmount
		},
		{
			amount: -input.discountAmount,
			description: `${input.discountPercent}% package discount`,
			quantity: 1,
			rate: -input.discountAmount
		}
	];
}

export function buildBookingInvoiceData(input: BookingInvoiceBuilderInput): BookingInvoiceData {
	const computedAmounts = calculateBookingInvoiceAmounts({
		duration: input.duration,
		addons: input.addons,
		...pickBookingAddonQuantities(input),
		includeBaseAmount: Boolean(input.service),
		includeDepositLineItem: input.includeDepositLineItem !== false
	});
	const customTotalDueAmount = input.customTotalDueAmount;
	const manualPriceAdjustmentAmount =
		customTotalDueAmount === undefined ? 0 : customTotalDueAmount - computedAmounts.totalDueAmount;
	const amounts = {
		...computedAmounts,
		subtotalAmount: computedAmounts.subtotalAmount + manualPriceAdjustmentAmount,
		totalDueAmount: customTotalDueAmount ?? computedAmounts.totalDueAmount
	};
	const bookingDateLabel = formatCalendarDate(input.date);
	const dueDate = input.dueDate ?? input.date;
	const invoiceDate = input.createdAt ?? Date.now();
	const invoiceDateLabel = format(invoiceDate, "d MMMM yyyy");
	const dueDateLabel = formatCalendarDate(dueDate);
	const addonQuantities = pickBookingAddonQuantities(input);
	const addonsSummary =
		input.addons.length > 0
			? input.addons
					.map((addon) => {
						const quantity = getAddonQuantity(addon, addonQuantities);
						const quantityLabel = quantity > 1 ? ` x ${quantity}` : "";

						return `${addon}${quantityLabel} (${getAddonAmount(addon, addonQuantities).toFixed(2)})`;
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
			description: addon,
			quantity: getAddonQuantity(addon, addonQuantities),
			rate: ADDON_PRICES[addon]
		})),
		...(input.includeDepositLineItem === false
			? []
			: [
					{
						amount: -BOOKING_DEPOSIT_AMOUNT,
						description: "Deposit paid",
						quantity: 1,
						rate: -BOOKING_DEPOSIT_AMOUNT
					}
				]),
		...(manualPriceAdjustmentAmount === 0
			? []
			: [
					{
						amount: manualPriceAdjustmentAmount,
						description: "Manual price adjustment",
						quantity: 1,
						rate: manualPriceAdjustmentAmount
					}
				])
	];

	const noticeWindowLabel = formatNoticeWindowLabel(input.leadTimeMinutes);

	return {
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
		invoice: {
			dueDate,
			dueDateLabel,
			invoiceDate: new Date(invoiceDate).toISOString(),
			invoiceDateLabel,
			number: input.invoiceNumber ?? formatBookingInvoiceNumber(input.bookingId, invoiceDate),
			title: BOOKING_INVOICE_TITLE
		},
		lineItems,
		notes: {
			cancellationPolicy: BOOKING_INVOICE_NOTES.getCancellationPolicy(noticeWindowLabel),
			paymentNote: BOOKING_INVOICE_NOTES.paymentNote
		},
		payment: {
			accountNumber: BOOKING_INVOICE_PAYMENT.accountNumber,
			bankTransferLabel: BOOKING_INVOICE_PAYMENT.bankTransferLabel,
			bsb: BOOKING_INVOICE_PAYMENT.bsb,
			payId: BOOKING_INVOICE_PAYMENT.payId,
			payIdLabel: BOOKING_INVOICE_PAYMENT.payIdLabel
		},
		rescheduleUrl: input.rescheduleUrl
	};
}

export function buildPackageAdjustmentInvoiceData(input: {
	abn?: string;
	accountName: string;
	bookedAt: number;
	createdAt: number;
	duration: BookingInvoiceBuilderInput["duration"];
	email: string;
	invoiceDueAt: number;
	invoiceNumber: string;
	name: string;
	packageSize: number;
	phone: string;
	quantity: number;
	rate: number;
	totalAmount: number;
}): BookingInvoiceData {
	const invoiceDateLabel = format(input.createdAt, "d MMMM yyyy");
	const dueDate = format(input.invoiceDueAt, "yyyy-MM-dd");
	const dueDateLabel = format(input.invoiceDueAt, "d MMMM yyyy");

	return {
		adjustment: {
			bookedAtLabel: format(input.bookedAt, "d MMMM yyyy"),
			packageSize: input.packageSize
		},
		amounts: {
			addonsAmount: input.totalAmount,
			baseAmount: 0,
			currency: BOOKING_INVOICE_CURRENCY,
			depositAmount: 0,
			subtotalAmount: input.totalAmount,
			totalDueAmount: input.totalAmount
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
		invoice: {
			dueDate,
			dueDateLabel,
			invoiceDate: new Date(input.createdAt).toISOString(),
			invoiceDateLabel,
			number: input.invoiceNumber,
			title: BOOKING_INVOICE_TITLE
		},
		lineItems: [
			{
				amount: input.totalAmount,
				description: "Remote Podcast",
				quantity: input.quantity,
				rate: input.rate
			}
		],
		notes: {
			cancellationPolicy: "",
			paymentNote: "Payment is due within 7 days via Bank Transfer or PayID."
		},
		payment: {
			accountNumber: BOOKING_INVOICE_PAYMENT.accountNumber,
			bankTransferLabel: BOOKING_INVOICE_PAYMENT.bankTransferLabel,
			bsb: BOOKING_INVOICE_PAYMENT.bsb,
			payId: BOOKING_INVOICE_PAYMENT.payId,
			payIdLabel: BOOKING_INVOICE_PAYMENT.payIdLabel
		}
	};
}

export function buildMultiBookingInvoiceData(
	input: {
		abn?: string;
		accountName: string;
		addons: BookingInvoiceBuilderInput["addons"];
		bookingId: BookingInvoiceBuilderInput["bookingId"];
		createdAt: number;
		discountAmount: number;
		discountPercent: number;
		duration: BookingInvoiceBuilderInput["duration"];
		email: string;
		invoiceDueAt: number;
		invoiceLineItems: BookingInvoiceLineItem[];
		invoiceNumber?: string;
		name: string;
		leadTimeMinutes: number;
		packageSize: number;
		packageSubtotalAmount: number;
		phone: string;
		service?: NonNullable<BookingInvoiceBuilderInput["service"]>;
		totalDueAmount: number;
	} & BookingAddonQuantities
): BookingInvoiceData {
	const addonQuantities = pickBookingAddonQuantities(input);
	const invoiceDateLabel = format(input.createdAt, "d MMMM yyyy");
	const dueDate = format(input.invoiceDueAt, "yyyy-MM-dd");
	const dueDateLabel = format(input.invoiceDueAt, "d MMMM yyyy");
	const addonsSummary =
		input.addons.length > 0
			? input.addons
					.map((addon) => {
						const quantity = getAddonQuantity(addon, addonQuantities);
						const quantityLabel = quantity > 1 ? ` x ${quantity}` : "";

						return `${addon}${quantityLabel}`;
					})
					.join(", ")
			: "No add-ons selected";
	const multiBookingLineItems = input.invoiceLineItems;

	const noticeWindowLabel = formatNoticeWindowLabel(input.leadTimeMinutes);

	return {
		amounts: {
			addonsAmount: 0,
			baseAmount: input.packageSubtotalAmount,
			currency: BOOKING_INVOICE_CURRENCY,
			depositAmount: 0,
			subtotalAmount: input.packageSubtotalAmount,
			totalDueAmount: input.totalDueAmount
		},
		booking: {
			addons: input.addons,
			addonsSummary,
			bookingDate: "unscheduled",
			bookingDateLabel: "To be scheduled after payment",
			duration: input.duration,
			service: input.service,
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
		invoice: {
			dueDate,
			dueDateLabel,
			invoiceDate: new Date(input.createdAt).toISOString(),
			invoiceDateLabel,
			number: input.invoiceNumber ?? formatBookingInvoiceNumber(input.bookingId, input.createdAt),
			title: BOOKING_INVOICE_TITLE
		},
		lineItems: multiBookingLineItems,
		notes: {
			cancellationPolicy:
				BOOKING_INVOICE_NOTES.getMultiBookingCancellationPolicy(noticeWindowLabel),
			paymentNote: BOOKING_INVOICE_NOTES.multiBookingPaymentNote
		},
		package: { size: input.packageSize },
		payment: {
			accountNumber: BOOKING_INVOICE_PAYMENT.accountNumber,
			bankTransferLabel: BOOKING_INVOICE_PAYMENT.bankTransferLabel,
			bsb: BOOKING_INVOICE_PAYMENT.bsb,
			payId: BOOKING_INVOICE_PAYMENT.payId,
			payIdLabel: BOOKING_INVOICE_PAYMENT.payIdLabel
		}
	};
}
