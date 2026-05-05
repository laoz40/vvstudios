import type {
	BookingAddon,
	BookingDuration,
	BookingService,
} from "#/features/booking-invoice/lib/types";

export const BOOKING_INVOICE_TITLE = "Tax Invoice";
export const BOOKING_INVOICE_CURRENCY = "AUD" as const;
export const BOOKING_DEPOSIT_AMOUNT = 50;

export const SERVICE_LABELS: Record<BookingService, string> = {
	"Armchair Setup": "Armchair Setup",
	"Table Setup": "Table Setup",
};

export const DURATION_PRICES: Record<BookingDuration, number> = {
	"1h": 200,
	"2h": 299,
	"3h": 399,
};

export const ADDON_PRICES: Record<BookingAddon, number> = {
	"4K UHD Recording": 49,
	"Clips Package": 79,
	"Essential Edit": 99,
};

export const BOOKING_INVOICE_BUSINESS = {
	abn: "97 592 829 541",
	businessName: "Vertigo Visuals",
	contactEmail: "contact@vertigovisuals.com.au",
	locationAddress: "23 Fields Rd, Macquarie Fields NSW 2564",
	locationLabel: "VV Studios",
	locationUrl: "https://maps.app.goo.gl/pVx8fg9S4LhtKVjG7",
	logoUrl: "https://vertigovisuals.com.au/vv-logo-yellow.png",
	ownerName: "Joseph Gerges",
	websiteLabel: "vertigovisuals.com.au",
	websiteUrl: "https://vertigovisuals.com.au",
} as const;

export const BOOKING_INVOICE_PAYMENT = {
	accountNumber: "432849833",
	bankTransferLabel: "Bank Transfer",
	bsb: "082-124",
	payId: "0434367184",
	payIdLabel: "PayID",
} as const;

export const BOOKING_INVOICE_NOTES = {
	cancellationPolicy:
		"The $50 booking deposit is non-refundable if the session is cancelled within 48 hours of the scheduled start time.",
	paymentNote:
		"Balance due by end of the booking date. Settle early via Bank Transfer or PayID, or pay in-studio. If transferring on the day, please email the receipt.",
} as const;
