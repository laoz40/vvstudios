import type {
	BookingStepTwoAddOnOption,
	BookingStepTwoContent,
} from "../../../content/bookingTypes";

export function toAddOnFieldName(value: string): string {
	return `addOn${value
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")}`;
}

export function getSelectedVideoFormatLabel(
	selectedVideoFormat: string,
	videoFormatOptions: BookingStepTwoContent["videoFormatOptions"],
): string {
	const match = videoFormatOptions.find(
		(option) => option.value === selectedVideoFormat,
	);

	return match?.label || "";
}

export function getSelectedAddOnLabels(
	selectedAddOns: string[],
	addOnOptions: BookingStepTwoAddOnOption[],
): string[] {
	return addOnOptions
		.filter((option) => selectedAddOns.includes(option.value))
		.map((option) => option.label);
}

export function createSelectedAddOnFields(
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
