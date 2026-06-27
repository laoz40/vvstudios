import { CONTACT_EMAIL, CONTACT_PHONE, STUDIO_ADDRESS, STUDIO_ADDRESS_URL } from "#/config/contact";
export const BOOKING_INVOICE_TITLE = "Tax Invoice";
export const BOOKING_DEPOSIT_AMOUNT = 50;

export const BOOKING_INVOICE_BUSINESS = {
	abn: "97 592 829 541",
	businessName: "Vertigo Visuals",
	contactEmail: CONTACT_EMAIL,
	contactPhone: CONTACT_PHONE,
	locationAddress: STUDIO_ADDRESS,
	locationLabel: "VV Studios",
	locationUrl: STUDIO_ADDRESS_URL,
	logoUrl: "https://vertigovisuals.au/icons/studio/android-chrome-192x192.png",
	ownerName: "Joseph Gerges",
	websiteLabel: "vertigovisuals.au",
	websiteUrl: "https://vertigovisuals.au"
} as const;

export const BOOKING_INVOICE_PAYMENT = {
	accountNumber: "432849833",
	bankTransferLabel: "Bank Transfer",
	bsb: "082-124",
	payId: CONTACT_PHONE,
	payIdLabel: "PayID"
} as const;

export const BOOKING_INVOICE_NOTES = {
	cancellationPolicy:
		"The booking deposit is non-refundable. Bookings may be rescheduled with a minimum of 24 hours notice. Late cancellations or no-shows will forfeit the deposit.",
	paymentNote:
		"Settle remaining balance early via Bank Transfer or PayID, or pay in-studio (credit card fees apply)."
} as const;
