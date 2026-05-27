import { hasEditingAddon } from "#studio/features/booking-form/lib/form-shared";
import {
	ADDON_PRICES,
	BOOKING_DEPOSIT_AMOUNT,
	BOOKING_INVOICE_CURRENCY,
	DURATION_PRICES,
} from "#studio/features/booking-invoice/lib/constants";
import { sumMoney } from "#studio/features/booking-invoice/lib/money";
import type { BookingInvoiceMoneyAmounts } from "#studio/features/booking-invoice/lib/types";

function isBookingAddon(value: string): value is keyof typeof ADDON_PRICES {
	return value in ADDON_PRICES;
}

function isBookingDuration(value: string): value is keyof typeof DURATION_PRICES {
	return value in DURATION_PRICES;
}

export function getAddonQuantity(addon: string, deliverableCount?: string) {
	if (!isBookingAddon(addon)) {
		return 0;
	}

	// Non-editing add-ons are one-time charges. Editing add-ons are charged
	// once per deliverable, e.g. once per episode.
	if (!hasEditingAddon([addon])) {
		return 1;
	}

	const parsedDeliverableCount = Number(deliverableCount);

	return Number.isInteger(parsedDeliverableCount) && parsedDeliverableCount > 0
		? parsedDeliverableCount
		: 1;
}

export function getAddonAmount(addon: string, deliverableCount?: string) {
	// Add-on total is unit price multiplied by the quantity rules above.
	return isBookingAddon(addon)
		? ADDON_PRICES[addon] * getAddonQuantity(addon, deliverableCount)
		: 0;
}

export type CalculateBookingInvoiceAmountsInput = {
	duration: string;
	addons: readonly string[];
	deliverableCount?: string;
	includeBaseAmount?: boolean;
	includeDepositLineItem?: boolean;
};

export function calculateBookingInvoiceAmounts({
	duration,
	addons,
	deliverableCount,
	includeBaseAmount = true,
	includeDepositLineItem = true,
}: CalculateBookingInvoiceAmountsInput): BookingInvoiceMoneyAmounts {
	const baseAmount =
		includeBaseAmount && isBookingDuration(duration) ? DURATION_PRICES[duration] : 0;
	const addonsAmount = sumMoney(addons.map((addon) => getAddonAmount(addon, deliverableCount)));
	const subtotalAmount = baseAmount + addonsAmount;
	const depositAmount = includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;
	const totalDueAmount = Math.max(subtotalAmount - depositAmount, 0);

	return {
		addonsAmount,
		baseAmount,
		currency: BOOKING_INVOICE_CURRENCY,
		depositAmount,
		subtotalAmount,
		totalDueAmount,
	};
}
