export function formatAud(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		currency: "AUD",
		style: "currency",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}
