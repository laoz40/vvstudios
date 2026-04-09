import type { DateValue } from "@internationalized/date";

export function getDateString(selectedDate: DateValue | undefined): string {
	if (!selectedDate) {
		return "";
	}

	return `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}`;
}

export function formatSelectedDate(selectedDate: DateValue | undefined): string {
	if (!selectedDate) {
		return "";
	}

	const date = new Date(
		selectedDate.year,
		selectedDate.month - 1,
		selectedDate.day,
	);

	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
}

export function getDurationValue(selectedDuration: string): string {
	return selectedDuration.replace(/[^0-9+]/g, "");
}
