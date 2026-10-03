import {
	DURATION_OPTIONS,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";

export const BOOKING_INVOICE_CURRENCY = "AUD" as const;

type BookingDuration = (typeof DURATION_OPTIONS)[number];

export const DURATION_PRICES = { "1h": 200, "2h": 299, "3h": 399 } as const satisfies Record<
	BookingDuration,
	number
>;

export const ADDON_PRICES = {
	"4K UHD Recording": 49,
	Teleprompter: 29,
	"Essential Edit": 100,
	"Clip Volume Pack": 80,
	"Complete Edit": 249,
	"Handcrafted Clips": 199,
	"Remote Podcast": 59
} as const satisfies Record<BookingAddon, number>;

export const PACKAGE_PLANS = {
	4: { discountPercent: 5, validityDays: 60 },
	8: { discountPercent: 10, validityDays: 120 },
	12: { discountPercent: 15, validityDays: 180 }
} as const;

export type PackageSize = keyof typeof PACKAGE_PLANS;
