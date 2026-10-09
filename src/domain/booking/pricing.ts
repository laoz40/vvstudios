import { DURATION_OPTIONS, type BookingAddon } from "#/domain/booking/catalog";
import {
	getBookingAddonQuantityForForm,
	type BookingAddonQuantities,
	pickBookingAddonQuantities
} from "#/domain/booking/addon-quantities";
import {
	getPackagePriceSubtotalBeforeDiscount,
	getSessionPriceAmounts,
	isBookingDuration
} from "#/domain/booking/billable-line-items";
import { PACKAGE_PLANS, type PackageSize } from "#/domain/booking/price-constants";

type BookingDuration = (typeof DURATION_OPTIONS)[number];

export function isPackageSize(value: unknown): value is PackageSize {
	return value === 4 || value === 8 || value === 12;
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
	addons: readonly BookingAddon[];
	duration: BookingDuration | "";
	packageSize: PackageSize;
	includeDiscount?: boolean;
} & BookingAddonQuantities;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function roundMoneyAmount(amount: number) {
	return Math.round(amount * 100) / 100;
}

export function getBookingTotal(
	values: { addons: readonly BookingAddon[]; duration: string } & BookingAddonQuantities
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
