import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities
} from "#/domain/booking/addon-quantities";
import { type BookingAddon } from "#/domain/booking/catalog";
import { getSessionPriceAmounts } from "#/domain/booking/billable-line-items";
import {
	getAddonAmount,
	getAddonQuantity
} from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type { BookingReceiptMoneyAmounts } from "#studio/features/booking-invoice/lib/types";

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

	const { baseAmount, addonsAmount, subtotalAmount } = getSessionPriceAmounts({
		duration: includeBaseAmount ? duration : "",
		addons,
		addonQuantity: (addon) => getAddonQuantity(addon, addonQuantities)
	});

	return {
		addonsAmount,
		baseAmount,
		currency: "AUD",
		subtotalAmount,
		totalPaidAmount: subtotalAmount
	};
}

export { getAddonAmount, getAddonQuantity };
