import { getEditingAddonQuantity } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	hasEditingAddon,
	pickBookingAddonQuantities,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	ADDON_PRICES,
	BOOKING_INVOICE_CURRENCY,
	DURATION_PRICES
} from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { sumMoney } from "#studio/features/booking-invoice/lib/money";
import type { BookingInvoiceMoneyAmounts } from "#studio/features/booking-invoice/lib/types";

function isBookingDuration(value: string): value is keyof typeof DURATION_PRICES {
	return value in DURATION_PRICES;
}

export function getAddonQuantity(addon: BookingAddon, quantities: BookingAddonQuantities = {}) {
	// Non-editing add-ons are one-time charges. Quantity-tracked add-ons are charged
	// by their own selected quantity, e.g. 1 Essential Edit and 2 Clip Volume Packs.
	if (!hasEditingAddon([addon])) {
		return 1;
	}

	return getEditingAddonQuantity(addon, quantities, 1);
}

export function getAddonAmount(addon: BookingAddon, quantities: BookingAddonQuantities = {}) {
	// Add-on total is unit price multiplied by the quantity rules above.
	return ADDON_PRICES[addon] * getAddonQuantity(addon, quantities);
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
	const baseAmount =
		includeBaseAmount && isBookingDuration(duration) ? DURATION_PRICES[duration] : 0;
	const addonQuantities = pickBookingAddonQuantities(quantityValues);
	const addonsAmount = sumMoney(addons.map((addon) => getAddonAmount(addon, addonQuantities)));
	const subtotalAmount = baseAmount + addonsAmount;
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
