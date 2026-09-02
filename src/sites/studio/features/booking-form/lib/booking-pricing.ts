import { getBookingAddonQuantityForForm } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	DURATION_OPTIONS,
	pickBookingAddonQuantities,
	type BookingAddon,
	type BookingAddonQuantities,
	type BookingFormValues
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
	"Essential Edit": 99,
	"Clip Volume Pack": 79,
	"Complete Edit": 249,
	"Handcrafted Clips": 199,
	"Remote Podcast": 59
} as const satisfies Record<BookingAddon, number>;

export const MULTI_BOOKING_PLANS = {
	4: { discountPercent: 5, validityDays: 60 },
	8: { discountPercent: 10, validityDays: 120 },
	12: { discountPercent: 15, validityDays: 180 }
} as const;

export type MultiBookingSize = keyof typeof MULTI_BOOKING_PLANS;

export function isMultiBookingSize(value: unknown): value is MultiBookingSize {
	return typeof value === "number" && value in MULTI_BOOKING_PLANS;
}

export type MultiBookingAmounts = {
	discountAmount: number;
	discountPercent: number;
	packageSize: MultiBookingSize;
	packageSubtotalAmount: number;
	singleSessionAmount: number;
	totalDueAmount: number;
};

export type MultiBookingPricingValues = {
	addons: BookingFormValues["addons"];
	duration: BookingFormValues["duration"] | "";
	packageSize: MultiBookingSize;
	includeDiscount?: boolean;
} & BookingAddonQuantities;

const MULTI_BOOKING_INVOICE_DUE_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function roundMoneyAmount(amount: number) {
	return Math.round(amount * 100) / 100;
}

export function formatBookingPrice(price: number) {
	return `$${price}`;
}

export function formatBookingPriceWithCents(price: number) {
	return `$${price.toLocaleString("en-AU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
}

export { getBookingAddonQuantityForForm as getBookingAddonQuantity };

export function getBookingTotal(
	values: {
		addons: BookingFormValues["addons"];
		duration: BookingFormValues["duration"] | "";
	} & BookingAddonQuantities
) {
	const durationTotal = values.duration ? DURATION_PRICES[values.duration] : 0;
	const addonQuantities = pickBookingAddonQuantities(values);
	const addonsTotal = values.addons.reduce((total, addon) => {
		return total + ADDON_PRICES[addon] * getBookingAddonQuantityForForm(addon, addonQuantities);
	}, 0);

	return durationTotal + addonsTotal;
}

export function calculatePackageAmounts(values: MultiBookingPricingValues): MultiBookingAmounts {
	const plan = MULTI_BOOKING_PLANS[values.packageSize];
	const singleSessionAmount = getBookingTotal(values);
	const packageSubtotalAmount = singleSessionAmount * values.packageSize;
	const discountAmount =
		values.includeDiscount === false
			? 0
			: roundMoneyAmount(packageSubtotalAmount * (plan.discountPercent / 100));

	return {
		discountAmount,
		discountPercent: plan.discountPercent,
		packageSize: values.packageSize,
		packageSubtotalAmount,
		singleSessionAmount,
		totalDueAmount: roundMoneyAmount(packageSubtotalAmount - discountAmount)
	};
}

export function getMultiBookingInvoiceDueAt(createdAt: number) {
	return createdAt + MULTI_BOOKING_INVOICE_DUE_DAYS * MILLISECONDS_PER_DAY;
}

export function getMultiBookingExpiresAt(paidAt: number, packageSize: MultiBookingSize) {
	const plan = MULTI_BOOKING_PLANS[packageSize];

	return paidAt + plan.validityDays * MILLISECONDS_PER_DAY;
}
