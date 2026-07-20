import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { getAddonAmount } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type { BookingDuration } from "#studio/features/booking-invoice/lib/types";

export type CustomInvoiceTotalDraftResult =
	| { status: "empty" }
	| { status: "invalid" }
	| { status: "valid"; amount: number };

export function parseCustomInvoiceTotalDraft(draft: string): CustomInvoiceTotalDraftResult {
	const trimmedDraft = draft.trim();

	if (!trimmedDraft) {
		return { status: "empty" };
	}

	const result = parseRemainingBalanceAmountDraft(trimmedDraft);

	if (result.status === "invalid") {
		return { status: "invalid" };
	}

	return { status: "valid", amount: result.amount };
}

const audCurrencyFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatCustomInvoiceCurrency(amount: number) {
	return audCurrencyFormatter.format(amount);
}

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

export function formatCustomInvoiceTotal(input: {
	service?: string;
	addons: readonly string[];
	duration: string;
	includeDepositLineItem: boolean;
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	customTotalDueAmount?: number;
}) {
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

export function formatCustomInvoiceAddonText(input: {
	addons: BookingFormValues["addons"];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
}) {
	if (input.addons.length === 0) {
		return "";
	}

	return ` · ${formatEditingAddonList(input.addons, {
		essentialEditQuantity: input.essentialEditQuantity,
		clipsPackageQuantity: input.clipsPackageQuantity
	})}`;
}
