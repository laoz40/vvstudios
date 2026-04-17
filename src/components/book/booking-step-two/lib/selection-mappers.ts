import type { BookingStepTwoAddOnOption } from "../../../../content/bookingTypes";

// turn a kebab-case add-on value into a form field name
export function toAddOnFieldName(value: string): string {
	return `addOn${value
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")}`;
}

// filter the chosen add-ons and return their labels
export function getSelectedAddOnLabels(
	selectedAddOns: string[],
	addOnOptions: BookingStepTwoAddOnOption[],
): string[] {
	return addOnOptions
		.filter((option) => selectedAddOns.includes(option.value))
		.map((option) => option.label);
}

// convert add-on options into boolean values keyed by field name
export function mapAllAddOnsToBooleanSelectionState(
	selectedAddOns: string[],
	addOnOptions: BookingStepTwoAddOnOption[],
): Record<string, boolean> {
	return Object.fromEntries(
		addOnOptions.map((option) => [
			toAddOnFieldName(option.value),
			selectedAddOns.includes(option.value),
		]),
	);
}
