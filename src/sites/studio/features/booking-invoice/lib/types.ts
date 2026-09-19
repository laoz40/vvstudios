import type { GenericId } from "convex/values";
import type {
	BookingAddon,
	BookingAddonQuantities,
	BookingService,
	DURATION_OPTIONS
} from "#studio/features/booking-form/lib/booking-form-model";

export type { BookingService };

export type BookingDuration = (typeof DURATION_OPTIONS)[number];

export type BookingInvoiceBuilderInput = {
	bookingId: GenericId<"bookings"> | GenericId<"packages">;
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
} & BookingAddonQuantities & {
		leadTimeMinutes: number;
		createdAt?: number;
		includeDepositLineItem?: boolean;
		invoiceNumber?: string;
		rescheduleUrl?: string;
		customTotalDueAmount?: number;
	};

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

export type BookingReceiptBuilderInput = Omit<
	BookingInvoiceBuilderInput,
	"customTotalDueAmount" | "dueDate" | "includeDepositLineItem" | "invoiceNumber"
> & { receiptNumber?: string };

export interface BookingReceiptMoneyAmounts {
	addonsAmount: number;
	baseAmount: number;
	currency: "AUD";
	subtotalAmount: number;
	totalPaidAmount: number;
}

export type PackageReceiptBuilderInput = {
	packageId: GenericId<"packages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: BookingDuration;
	addons: BookingAddon[];
	paidAt: number;
	packageSize: number;
	packageSubtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalDueAmount: number;
	invoiceLineItems: BookingInvoiceLineItem[];
	leadTimeMinutes: number;
	receiptNumber?: string;
	scheduleExpiresAtLabel?: string;
	scheduleUrl?: string;
} & BookingAddonQuantities;

type BookingReceiptSharedData = {
	amounts: BookingReceiptMoneyAmounts;
	booking: BookingInvoiceData["booking"];
	branding: BookingInvoiceData["branding"];
	customer: BookingInvoiceData["customer"];
	lineItems: BookingInvoiceLineItem[];
	notes: { cancellationPolicy: string };
	receipt: { number: string; receiptDate: string; receiptDateLabel: string; title: string };
};

export type BookingReceiptData =
	| (BookingReceiptSharedData & { kind: "booking"; rescheduleUrl?: string })
	| (BookingReceiptSharedData & {
			kind: "package";
			leadTimeMinutes: number;
			package: { size: number };
			scheduleExpiresAtLabel?: string;
			scheduleUrl?: string;
	  });

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
