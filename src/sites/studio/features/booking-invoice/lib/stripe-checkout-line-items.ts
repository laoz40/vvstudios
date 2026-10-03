import { err, ok, type Result } from "neverthrow";
import {
	pickBookingAddonQuantities,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildPackagePriceLines,
	buildSessionPriceLines,
	isBookingDuration
} from "#studio/features/booking-form/lib/billable-line-items";
import {
	BOOKING_INVOICE_CURRENCY,
	calculatePackageAmounts,
	getBookingAddonQuantity,
	type PackageSize
} from "#studio/features/booking-form/lib/booking-pricing";

export type SessionCheckoutLineItem = {
	quantity: number;
	price_data: { currency: string; unit_amount: number; product_data: { name: string } };
};

function audToStripeUnitAmount(amount: number) {
	return Math.round(amount * 100);
}

function toSessionCheckoutLineItem(pricedLine: {
	description: string;
	quantity: number;
	unitAmount: number;
}): SessionCheckoutLineItem {
	return {
		quantity: pricedLine.quantity,
		price_data: {
			currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
			unit_amount: audToStripeUnitAmount(pricedLine.unitAmount),
			product_data: { name: pricedLine.description }
		}
	};
}

export type BuildSessionCheckoutLineItemsInput = {
	duration: string;
	addons: readonly BookingAddon[];
} & BookingAddonQuantities;

export type BuildSessionCheckoutLineItemsError = { reason: "BOOKING_INVALID_DURATION" };

export function buildSessionCheckoutLineItems(
	input: BuildSessionCheckoutLineItemsInput
): Result<SessionCheckoutLineItem[], BuildSessionCheckoutLineItemsError> {
	if (!isBookingDuration(input.duration)) {
		return err({ reason: "BOOKING_INVALID_DURATION" });
	}

	const addonQuantities = pickBookingAddonQuantities(input);

	const lineItems = buildSessionPriceLines({
		duration: input.duration,
		addons: input.addons,
		addonQuantity: (addon) => getBookingAddonQuantity(addon, addonQuantities)
	}).map((pricedLine) => toSessionCheckoutLineItem(pricedLine));

	return ok(lineItems);
}

export type PackageCheckoutDiscount = { amount: number; description: string };

export type PackageCheckoutLineItems = {
	discount: PackageCheckoutDiscount;
	lineItems: SessionCheckoutLineItem[];
};

export type PackageCheckoutPricing = {
	duration: string;
	addons: readonly BookingAddon[];
	packageSize: PackageSize;
	essentialEditQuantity?: string;
	completeEditQuantity?: string;
	clipsPackageQuantity?: string;
	handcraftedClipsQuantity?: string;
};

export type BuildPackageCheckoutLineItemsError = { reason: "BOOKING_INVALID_DURATION" };

export function buildPackageCheckoutLineItems(
	packageFromDb: PackageCheckoutPricing
): Result<PackageCheckoutLineItems, BuildPackageCheckoutLineItemsError> {
	if (!isBookingDuration(packageFromDb.duration)) {
		return err({ reason: "BOOKING_INVALID_DURATION" });
	}

	const addonQuantities = pickBookingAddonQuantities(packageFromDb);

	const packageAmounts = calculatePackageAmounts({
		addons: [...packageFromDb.addons],
		duration: packageFromDb.duration,
		packageSize: packageFromDb.packageSize,
		...addonQuantities
	});

	const lineItems = buildPackagePriceLines({
		duration: packageFromDb.duration,
		packageSize: packageFromDb.packageSize,
		addons: packageFromDb.addons,
		addonQuantityPerSession: (addon) => getBookingAddonQuantity(addon, addonQuantities)
	}).map((pricedLine) => toSessionCheckoutLineItem(pricedLine));

	return ok({
		discount: {
			amount: packageAmounts.discountAmount,
			description: `${packageAmounts.discountPercent}% package discount`
		},
		lineItems
	});
}
