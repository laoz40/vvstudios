const audCurrencyFormatter = new Intl.NumberFormat("en-AU", {
	currency: "AUD",
	style: "currency",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatAud(amount: number) {
	return audCurrencyFormatter.format(amount);
}
