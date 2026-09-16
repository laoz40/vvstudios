type RemainingBalanceAmountParseResult =
	| { status: "valid"; amount: number }
	| { status: "invalid" };

export function parseRemainingBalanceAmountDraft(draft: string): RemainingBalanceAmountParseResult {
	const trimmedDraft = draft.trim();

	if (trimmedDraft === "") {
		return { status: "invalid" };
	}

	const amount = Number(trimmedDraft);

	if (!Number.isFinite(amount) || amount < 0) {
		return { status: "invalid" };
	}

	return { status: "valid", amount };
}

export function formatAudAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
	}).format(amount);
}
