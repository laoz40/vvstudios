import {
	getPackagePriceSubtotalBeforeDiscount,
	getSessionPriceAmounts,
	isBookingDuration
} from "#studio/features/booking-form/lib/billable-line-items";
import { getBookingAddonQuantityForForm } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	ADDON_PRICES,
	BOOKING_INVOICE_CURRENCY,
	DURATION_PRICES,
	PACKAGE_PLANS,
	type PackageSize
} from "#studio/features/booking-form/lib/booking-price-constants";
import { z } from "zod";

export { ADDON_PRICES, BOOKING_INVOICE_CURRENCY, DURATION_PRICES, PACKAGE_PLANS, type PackageSize };

const packageSizeSchema = z.union([z.literal(4), z.literal(8), z.literal(12)]);

export function isPackageSize(value: unknown): value is PackageSize {
	return packageSizeSchema.safeParse(value).success;
}

export type PackageAmounts = {
	discountAmount: number;
	discountPercent: number;
	packageSize: PackageSize;
	packageSubtotalAmount: number;
	singleSessionAmount: number;
	totalDueAmount: number;
};

export type PackagePricingValues = {
	addons: BookingFormValues["addons"];
	duration: BookingFormValues["duration"] | "";
	packageSize: PackageSize;
	includeDiscount?: boolean;
} & BookingAddonQuantities;

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
	const addonQuantities = pickBookingAddonQuantities(values);

	return getSessionPriceAmounts({
		duration: values.duration,
		addons: values.addons,
		addonQuantity: (addon) => getBookingAddonQuantityForForm(addon, addonQuantities)
	}).subtotalAmount;
}

export function calculatePackageAmounts(values: PackagePricingValues): PackageAmounts {
	const plan = PACKAGE_PLANS[values.packageSize];
	const singleSessionAmount = getBookingTotal(values);
	const addonQuantities = pickBookingAddonQuantities(values);

	const packageSubtotalAmount = isBookingDuration(values.duration)
		? getPackagePriceSubtotalBeforeDiscount({
				duration: values.duration,
				packageSize: values.packageSize,
				addons: values.addons,
				addonQuantityPerSession: (addon) => getBookingAddonQuantityForForm(addon, addonQuantities)
			})
		: singleSessionAmount * values.packageSize;

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

export function getPackageExpiresAt(paidAt: number, packageSize: PackageSize) {
	const plan = PACKAGE_PLANS[packageSize];

	return paidAt + plan.validityDays * MILLISECONDS_PER_DAY;
}
