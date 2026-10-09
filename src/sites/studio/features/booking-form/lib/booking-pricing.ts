export function formatBookingPrice(price: number) {
	return `$${price}`;
}

export function formatBookingPriceWithCents(price: number) {
	return `$${price.toLocaleString("en-AU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
}
