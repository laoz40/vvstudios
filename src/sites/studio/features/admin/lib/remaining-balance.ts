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

function amountHasCents(amount: number) {
	return Math.round(amount * 100) % 100 !== 0;
}

export function formatAudAmount(amount: number, options?: { showCents?: boolean }) {
	const showCents = options?.showCents ?? amountHasCents(amount);

	return new Intl.NumberFormat("en-AU", {
		currency: "AUD",
		maximumFractionDigits: showCents ? 2 : 0,
		minimumFractionDigits: showCents ? 2 : 0,
		style: "currency"
	}).format(amount);
}

export function getAudAmountRowShowCents(amounts: readonly number[]) {
	return amounts.some(amountHasCents);
}
