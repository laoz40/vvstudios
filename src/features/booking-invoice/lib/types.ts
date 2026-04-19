import type { GenericId } from "convex/values";
import type {
	ADDON_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
} from "#/features/booking-form/lib/form-shared";

export type BookingService = (typeof SERVICES)[number];
export type BookingDuration = (typeof DURATION_OPTIONS)[number];
export type BookingAddon = (typeof ADDON_OPTIONS)[number];

export interface BookingInvoiceBuilderInput {
	bookingId: GenericId<"bookings">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: BookingDuration;
	service: BookingService;
	addons: BookingAddon[];
	createdAt?: number;
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
		service: BookingService;
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
	customer: {
		abn?: string;
		accountName: string;
		email: string;
		name: string;
		phone: string;
	};
	invoice: {
		dueDate: string;
		dueDateLabel: string;
		invoiceDate: string;
		invoiceDateLabel: string;
		number: string;
		title: string;
	};
	lineItems: BookingInvoiceLineItem[];
	notes: {
		cancellationPolicy: string;
		paymentNote: string;
	};
	payment: {
		accountNumber: string;
		bankTransferLabel: string;
		bsb: string;
		payId: string;
		payIdLabel: string;
	};
}

export interface BookingInvoiceArtifacts {
	data: BookingInvoiceData;
	emailHtml: string;
	pdf: {
		content: Uint8Array;
		contentType: "application/pdf";
		filename: string;
	};
}
