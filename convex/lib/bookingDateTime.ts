import { ConvexError } from "convex/values";

type DateParts = {
	year: number;
	month: number;
	day: number;
};

type TimeParts = {
	hours: number;
	minutes: number;
};

type BookingDateTimeErrorCode =
	| "BOOKING_INVALID_DATE"
	| "BOOKING_INVALID_DURATION"
	| "BOOKING_INVALID_TIME";

type BookingDateTimeErrorData = {
	code: BookingDateTimeErrorCode;
};

function createBookingDateTimeError(code: BookingDateTimeErrorCode) {
	return new ConvexError<BookingDateTimeErrorData>({ code });
}

function parseDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	throw createBookingDateTimeError("BOOKING_INVALID_DURATION");
}

function parseDate(date: string): DateParts {
	const [year, month, day] = date.split("-").map(Number);

	if (!year || !month || !day) {
		throw createBookingDateTimeError("BOOKING_INVALID_DATE");
	}

	return { year, month, day };
}

function parseTime(time: string): TimeParts {
	const [hours, minutes] = time.split(":").map(Number);

	if (hours === undefined || minutes === undefined) {
		throw createBookingDateTimeError("BOOKING_INVALID_TIME");
	}

	return { hours, minutes };
}

function formatDateTime(date: Date) {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	const hours = String(date.getUTCHours()).padStart(2, "0");
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");
	const seconds = String(date.getUTCSeconds()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function buildEventWindow(date: string, time: string, duration: string) {
	const dateParts = parseDate(date);
	const timeParts = parseTime(time);
	const durationMinutes = parseDurationMinutes(duration);

	const startUtc = new Date(
		Date.UTC(
			dateParts.year,
			dateParts.month - 1,
			dateParts.day,
			timeParts.hours,
			timeParts.minutes,
			0,
			0,
		),
	);
	const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

	return {
		startDateTime: formatDateTime(startUtc),
		endDateTime: formatDateTime(endUtc),
	};
}
