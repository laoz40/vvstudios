import type {
	BookingAddon,
	BookingDuration,
	BookingService,
} from "#studio/features/booking-invoice/lib/types";

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
	"Remote Podcast": 59,
};

export const BOOKING_INVOICE_BUSINESS = {
	abn: "97 592 829 541",
	businessName: "Vertigo Visuals",
	contactEmail: "contact@vertigovisuals.com.au",
	locationAddress: "23 Fields Rd, Macquarie Fields NSW 2564",
	locationLabel: "VV Studios",
	locationUrl: "https://maps.app.goo.gl/pVx8fg9S4LhtKVjG7",
	logoUrl: "https://vertigovisuals.com.au/icons/studio/android-chrome-192x192.png",
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
		"The booking deposit is non-refundable. Bookings may be rescheduled with a minimum of 24 hours notice. Late cancellations or no-shows will forfeit the deposit.",
	paymentNote:
		"Settle remaining balance early via Bank Transfer or PayID, or pay in-studio (credit card fees apply).",
} as const;
