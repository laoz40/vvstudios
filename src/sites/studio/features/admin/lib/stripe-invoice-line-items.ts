import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";

export type StripeInvoiceLineItemDraft = { id: string; description: string; amount: string };

export type ParsedStripeInvoiceLineItem = { description: string; amount: number };

export function createStripeInvoiceLineItemDraft(): StripeInvoiceLineItemDraft {
	return { id: crypto.randomUUID(), description: "", amount: "" };
}

export function parseStripeInvoiceLineItemDrafts(
	drafts: StripeInvoiceLineItemDraft[]
): ParsedStripeInvoiceLineItem[] | null {
	if (drafts.length === 0) {
		return null;
	}

	const lineItems: ParsedStripeInvoiceLineItem[] = [];

	for (const draft of drafts) {
		const description = draft.description.trim();

		if (description.length === 0) {
			return null;
		}

		const amountResult = parseRemainingBalanceAmountDraft(draft.amount);

		if (amountResult.status === "invalid" || amountResult.amount <= 0) {
			return null;
		}

		lineItems.push({ description, amount: amountResult.amount });
	}

	return lineItems;
}

export function sumStripeInvoiceLineItemDrafts(drafts: StripeInvoiceLineItemDraft[]) {
	const lineItems = parseStripeInvoiceLineItemDrafts(drafts);

	if (lineItems === null) {
		return null;
	}

	return lineItems.reduce((total, lineItem) => total + lineItem.amount, 0);
}
