import type { GenericId } from "convex/values";
import type {
	BookingAddon,
	DURATION_OPTIONS,
	SERVICES
} from "#studio/features/booking-form/lib/booking-form-model";

export type BookingService = (typeof SERVICES)[number];
export type BookingDuration = (typeof DURATION_OPTIONS)[number];

export interface BookingInvoiceBuilderInput {
	bookingId: GenericId<"bookings"> | GenericId<"multiBookingPackages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	dueDate?: string;
	time: string;
	duration: BookingDuration;
	service?: BookingService;
	addons: BookingAddon[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	createdAt?: number;
	includeDepositLineItem?: boolean;
	invoiceNumber?: string;
	rescheduleUrl?: string;
}

export interface BookingInvoiceMoneyAmounts {
	addonsAmount: number;
	baseAmount: number;
	currency: "AUD";
	depositAmount: number;
	subtotalAmount: number;
	totalDueAmount: number;
}

export interface BookingInvoiceLineItem {
	amount: number;
	description: string;
	quantity: number;
	rate: number;
}

export interface BookingInvoiceData {
	amounts: BookingInvoiceMoneyAmounts;
	booking: {
		addons: BookingAddon[];
		addonsSummary: string;
		bookingDate: string;
		bookingDateLabel: string;
		duration: BookingDuration;
		service?: BookingService;
		time: string;
	};
	branding: {
		businessName: string;
		contactEmail: string;
		locationAddress: string;
		locationLabel: string;
		locationUrl: string;
		logoUrl?: string;
		ownerName: string;
		websiteLabel?: string;
		websiteUrl?: string;
	};
	customer: { abn?: string; accountName: string; email: string; name: string; phone: string };
	invoice: {
		dueDate: string;
		dueDateLabel: string;
		invoiceDate: string;
		invoiceDateLabel: string;
		number: string;
		title: string;
	};
	lineItems: BookingInvoiceLineItem[];
	notes: { cancellationPolicy: string; paymentNote: string };
	payment: {
		accountNumber: string;
		bankTransferLabel: string;
		bsb: string;
		payId: string;
		payIdLabel: string;
	};
	package?: { size: number };
	rescheduleUrl?: string;
}
