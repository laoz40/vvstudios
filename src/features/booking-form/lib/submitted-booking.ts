import type { ParsedBookingFormValues } from "#/features/booking-form/lib/form-shared";

const SUBMITTED_BOOKING_STORAGE_KEY = "submitted-booking";

export interface SubmittedBooking {
	name: string;
	date: string;
	time: string;
	duration: ParsedBookingFormValues["duration"];
	service: ParsedBookingFormValues["service"];
	addons: ParsedBookingFormValues["addons"];
}

export function persistSubmittedBooking(booking: SubmittedBooking) {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.setItem(SUBMITTED_BOOKING_STORAGE_KEY, JSON.stringify(booking));
}

export function readSubmittedBooking() {
	if (typeof window === "undefined") {
		return null;
	}

	const storedValue = window.sessionStorage.getItem(SUBMITTED_BOOKING_STORAGE_KEY);
	if (!storedValue) {
		return null;
	}

	try {
		const parsedValue: unknown = JSON.parse(storedValue);
		if (!isSubmittedBooking(parsedValue)) {
			return null;
		}

		return parsedValue;
	} catch {
		return null;
	}
}

export function clearSubmittedBooking() {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.removeItem(SUBMITTED_BOOKING_STORAGE_KEY);
}

function isSubmittedBooking(value: unknown): value is SubmittedBooking {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const booking = value as Record<string, unknown>;

	return (
		typeof booking.name === "string" &&
		typeof booking.date === "string" &&
		typeof booking.time === "string" &&
		typeof booking.duration === "string" &&
		typeof booking.service === "string" &&
		Array.isArray(booking.addons) &&
		booking.addons.every((addon) => typeof addon === "string")
	);
}
