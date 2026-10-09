import { getEditingAddonQuantity } from "#/domain/booking/addon-quantities";
import {
	hasEditingAddon,
	pickBookingAddonQuantities,
	type BookingAddonQuantities
} from "#/domain/booking/addon-quantities";
import { type BookingAddon } from "#/domain/booking/catalog";
import { buildAddonPricedLine, getSessionPriceAmounts } from "#/domain/booking/billable-line-items";
import { BOOKING_INVOICE_CURRENCY } from "#/domain/booking/price-constants";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import type { BookingInvoiceMoneyAmounts } from "#studio/features/booking-invoice/lib/types";

export function getAddonQuantity(addon: BookingAddon, quantities: BookingAddonQuantities = {}) {
	// Non-editing add-ons are one-time charges. Quantity-tracked add-ons are charged
	// by their own selected quantity, e.g. 1 Rough Cut and 2 Clip Volume Packs.
	if (!hasEditingAddon([addon])) {
		return 1;
	}

	return getEditingAddonQuantity(addon, quantities, 1);
}

export function getAddonAmount(addon: BookingAddon, quantities: BookingAddonQuantities = {}) {
	const pricedLine = buildAddonPricedLine(addon, getAddonQuantity(addon, quantities));

	return pricedLine?.amount ?? 0;
}

export type CalculateBookingInvoiceAmountsInput = {
	duration: string;
	addons: readonly BookingAddon[];
} & BookingAddonQuantities & { includeBaseAmount?: boolean; includeDepositLineItem?: boolean };

export function calculateBookingInvoiceAmounts({
	duration,
	addons,
	includeBaseAmount = true,
	includeDepositLineItem = true,
	...quantityValues
}: CalculateBookingInvoiceAmountsInput): BookingInvoiceMoneyAmounts {
	const addonQuantities = pickBookingAddonQuantities(quantityValues);

	const sessionPriceAmounts = getSessionPriceAmounts({
		duration: includeBaseAmount ? duration : "",
		addons,
		addonQuantity: (addon) => getAddonQuantity(addon, addonQuantities)
	});

	const { baseAmount, addonsAmount, subtotalAmount } = sessionPriceAmounts;
	const depositAmount = includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;
	const totalDueAmount = Math.max(subtotalAmount - depositAmount, 0);

	return {
		addonsAmount,
		baseAmount,
		currency: BOOKING_INVOICE_CURRENCY,
		depositAmount,
		subtotalAmount,
		totalDueAmount
	};
}
