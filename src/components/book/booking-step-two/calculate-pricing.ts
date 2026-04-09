import type {
	BookingStepTwoAddOnOption,
	BookingStepTwoContent,
} from "../../../content/bookingTypes";
import type { PricingLineItem } from "./booking-types";

export function parseCurrency(value: string): number {
	const normalized = value.replace(/[^0-9.-]/g, "");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: 0,
	}).format(value);
}

export function getSessionPriceFromDuration(duration: string): number {
	switch (duration.replace(/\s+/g, "").toLowerCase()) {
		case "1hr":
			return 200;
		case "2hr":
			return 299;
		case "3hr":
			return 399;
		default:
			return 0;
	}
}

export function createPricingItems(
	duration: string,
	selectedAddOns: string[],
	addOnOptions: BookingStepTwoAddOnOption[],
	summaryCopy: BookingStepTwoContent["summary"],
): PricingLineItem[] {
	const sessionPrice = getSessionPriceFromDuration(duration);
	// keep only selected add-ons and format them for display
	const addOnItems = addOnOptions
		.filter((option) => selectedAddOns.includes(option.value))
		.map((option) => ({
			label: option.label,
			amount: formatCurrency(parseCurrency(option.price)),
			isAddOn: true,
		}));
	// add up all selected add-on amounts
	const addOnTotal = addOnItems.reduce(
		(total, item) => total + parseCurrency(item.amount),
		0,
	);
	// apply the fixed booking deposit
	const deposit = 50;
	// calculate the final total after the deposit
	const total = sessionPrice + addOnTotal - deposit;

	return [
		{
			label: `${summaryCopy.labels.recordingSession}${duration ? ` (${duration})` : ""}`,
			amount: formatCurrency(sessionPrice),
		},
		...addOnItems,
		{
			label: summaryCopy.labels.bookingDeposit,
			amount: `-${formatCurrency(deposit)}`,
		},
		{
			label: summaryCopy.labels.total,
			amount: formatCurrency(total),
			isTotal: true,
		},
	];
}
