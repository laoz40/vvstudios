export function formatAud(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		currency: "AUD",
		style: "currency",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function sumMoney(amounts: number[]) {
	return amounts.reduce((total, amount) => total + amount, 0);
}
