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

export type CalculateBookingInvoiceAmountsInput = {
	duration: string;
	addons: readonly string[];
	includeBaseAmount?: boolean;
	includeDepositLineItem?: boolean;
};

export function calculateBookingInvoiceAmounts({
	duration,
	addons,
	includeBaseAmount = true,
	includeDepositLineItem = true,
}: CalculateBookingInvoiceAmountsInput): BookingInvoiceMoneyAmounts {
	const baseAmount = includeBaseAmount && isBookingDuration(duration) ? DURATION_PRICES[duration] : 0;
	const addonsAmount = sumMoney(
		addons.map((addon) => (isBookingAddon(addon) ? ADDON_PRICES[addon] : 0)),
	);
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
