import { CONTACT_EMAIL, CONTACT_PHONE, STUDIO_ADDRESS, STUDIO_ADDRESS_URL } from "#/config/contact";
import type { BookingAddon } from "#studio/features/booking-form/lib/form-shared";
import type { BookingDuration } from "#studio/features/booking-invoice/lib/types";

export const BOOKING_INVOICE_TITLE = "Tax Invoice";
export const BOOKING_INVOICE_CURRENCY = "AUD" as const;
export const BOOKING_DEPOSIT_AMOUNT = 50;

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
	contactEmail: CONTACT_EMAIL,
	contactPhone: CONTACT_PHONE,
	locationAddress: STUDIO_ADDRESS,
	locationLabel: "VV Studios",
	locationUrl: STUDIO_ADDRESS_URL,
	logoUrl: "https://vertigovisuals.com.au/icons/studio/android-chrome-192x192.png",
	ownerName: "Joseph Gerges",
	websiteLabel: "vertigovisuals.com.au",
	websiteUrl: "https://vertigovisuals.com.au",
} as const;

export const BOOKING_INVOICE_PAYMENT = {
	accountNumber: "432849833",
	bankTransferLabel: "Bank Transfer",
	bsb: "082-124",
	payId: CONTACT_PHONE,
	payIdLabel: "PayID",
} as const;

export const BOOKING_INVOICE_NOTES = {
	cancellationPolicy:
		"The booking deposit is non-refundable. Bookings may be rescheduled with a minimum of 24 hours notice. Late cancellations or no-shows will forfeit the deposit.",
	paymentNote:
		"Settle remaining balance early via Bank Transfer or PayID, or pay in-studio (credit card fees apply).",
} as const;
