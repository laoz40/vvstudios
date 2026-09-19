import {
	pickBookingAddonQuantities,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import {
	getAddonAmount,
	getAddonQuantity
} from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { sumMoney } from "#studio/features/booking-invoice/lib/money";
import type { BookingReceiptMoneyAmounts } from "#studio/features/booking-invoice/lib/types";

function isBookingDuration(value: string): value is keyof typeof DURATION_PRICES {
	return value in DURATION_PRICES;
}

export type CalculateBookingReceiptAmountsInput = {
	duration: string;
	addons: readonly BookingAddon[];
	includeBaseAmount?: boolean;
} & BookingAddonQuantities;

export function calculateBookingReceiptAmounts({
	duration,
	addons,
	includeBaseAmount = true,
	...quantityValues
}: CalculateBookingReceiptAmountsInput): BookingReceiptMoneyAmounts {
	const addonQuantities = pickBookingAddonQuantities(quantityValues);

	const baseAmount =
		includeBaseAmount && isBookingDuration(duration) ? DURATION_PRICES[duration] : 0;

	const addonsAmount = sumMoney(addons.map((addon) => getAddonAmount(addon, addonQuantities)));
	const subtotalAmount = baseAmount + addonsAmount;

	return {
		addonsAmount,
		baseAmount,
		currency: "AUD",
		subtotalAmount,
		totalPaidAmount: subtotalAmount
	};
}

export { getAddonAmount, getAddonQuantity };
