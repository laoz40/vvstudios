import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

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
