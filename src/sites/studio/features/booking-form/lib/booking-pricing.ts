import { addMonths } from "date-fns";
import { getBookingAddonQuantityForForm } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	DURATION_OPTIONS,
	type BookingAddon,
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
	"Clips Package": 79,
	"Remote Podcast": 59
} as const satisfies Record<BookingAddon, number>;

export const MULTI_BOOKING_PLANS = {
	4: { discountPercent: 5, validityMonths: 2 },
	8: { discountPercent: 10, validityMonths: 4 },
	12: { discountPercent: 15, validityMonths: 6 }
} as const;

export type MultiBookingSize = keyof typeof MULTI_BOOKING_PLANS;

export type MultiBookingAmounts = {
	currency: typeof BOOKING_INVOICE_CURRENCY;
	discountAmount: number;
	discountPercent: number;
	packageSize: MultiBookingSize;
	packageSubtotalAmount: number;
	singleSessionAmount: number;
	totalDueAmount: number;
};

export type MultiBookingPricingValues = Pick<
	BookingFormValues,
	"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
> & { packageSize: MultiBookingSize };

const MULTI_BOOKING_INVOICE_DUE_DAYS = 14;

function roundMoneyAmount(amount: number) {
	return Math.round(amount * 100) / 100;
}

export function formatBookingPrice(price: number) {
	return `$${price}`;
}

export { getBookingAddonQuantityForForm as getBookingAddonQuantity };

export function getBookingTotal(
	values: Pick<
		BookingFormValues,
		"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
	>
) {
	const durationTotal = values.duration ? DURATION_PRICES[values.duration] : 0;
	const addonsTotal = values.addons.reduce((total, addon) => {
		return total + ADDON_PRICES[addon] * getBookingAddonQuantityForForm(addon, values);
	}, 0);

	return durationTotal + addonsTotal;
}

export function calculateMultiBookingAmounts(
	values: MultiBookingPricingValues
): MultiBookingAmounts {
	const plan = MULTI_BOOKING_PLANS[values.packageSize];
	const singleSessionAmount = getBookingTotal(values);
	const packageSubtotalAmount = singleSessionAmount * values.packageSize;
	const discountAmount = roundMoneyAmount(packageSubtotalAmount * (plan.discountPercent / 100));

	return {
		currency: BOOKING_INVOICE_CURRENCY,
		discountAmount,
		discountPercent: plan.discountPercent,
		packageSize: values.packageSize,
		packageSubtotalAmount,
		singleSessionAmount,
		totalDueAmount: roundMoneyAmount(packageSubtotalAmount - discountAmount)
	};
}

export function getMultiBookingInvoiceDueAt(createdAt: number) {
	return createdAt + MULTI_BOOKING_INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000;
}

export function getMultiBookingExpiresAt(paidAt: number, packageSize: MultiBookingSize) {
	const plan = MULTI_BOOKING_PLANS[packageSize];

	return addMonths(paidAt, plan.validityMonths).getTime();
}
