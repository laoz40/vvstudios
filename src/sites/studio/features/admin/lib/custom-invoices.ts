import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type {
	BookingAddon,
	BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { getAddonAmount } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type { BookingDuration } from "#studio/features/booking-invoice/lib/types";

const audCurrencyFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatCustomInvoiceCurrency(amount: number) {
	return audCurrencyFormatter.format(amount);
}

export function formatCustomInvoiceAddonText(
	input: { addons: readonly BookingAddon[] } & BookingAddonQuantities
) {
	if (input.addons.length === 0) {
		return "";
	}

	return ` · ${formatEditingAddonList(input.addons, pickBookingAddonQuantities(input))}`;
}

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

export function formatCustomInvoiceTotal(
	input: {
		service?: string;
		addons: readonly BookingAddon[];
		duration: string;
		includeDepositLineItem: boolean;
		customTotalDueAmount?: number;
	} & BookingAddonQuantities
) {
	const serviceAmount =
		input.service && isBookingDuration(input.duration) ? DURATION_PRICES[input.duration] : 0;

	const addonsAmount = input.addons.reduce(
		(total, addon) => total + getAddonAmount(addon, input),
		0
	);

	const depositAmount = input.includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;
	const computedTotal = Math.max(serviceAmount + addonsAmount - depositAmount, 0);

	return formatCustomInvoiceCurrency(input.customTotalDueAmount ?? computedTotal);
}
