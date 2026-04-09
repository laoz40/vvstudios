import type {
	PersistedBookingData,
	PersistedBookingEnvelope,
} from "./booking-types";


const BOOKING_STORAGE_KEY = "vvstudios.booking.step2.v1";

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isPersistedBookingData(
	value: unknown,
): value is PersistedBookingData {
	if (!value || typeof value !== "object") {
		return false;
	}

	const data = value as Record<string, unknown>;
	return (
		isStringArray(data.selectedAddOns) &&
		typeof data.selectedVideoFormat === "string" &&
		typeof data.questionsOrRequests === "string" &&
		typeof data.fullName === "string" &&
		typeof data.phone === "string" &&
		typeof data.accountName === "string" &&
		typeof data.abn === "string" &&
		typeof data.email === "string"
	);
}

export function readStoredBooking(): PersistedBookingEnvelope | null {
	if (typeof window === "undefined") {
		return null;
	}

	const raw = window.localStorage.getItem(BOOKING_STORAGE_KEY);
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return null;
		}

		const envelope = parsed as Record<string, unknown>;
		if (
			envelope.version !== 1 ||
			typeof envelope.updatedAt !== "string" ||
			!isPersistedBookingData(envelope.data)
		) {
			return null;
		}

		return {
			version: 1,
			updatedAt: envelope.updatedAt,
			data: envelope.data,
		};
	} catch {
		return null;
	}
}

export function writeStoredBooking(data: PersistedBookingData): void {
	if (typeof window === "undefined") {
		return;
	}

	const envelope: PersistedBookingEnvelope = {
		version: 1,
		updatedAt: new Date().toISOString(),
		data,
	};

	window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(envelope));
}

export function sanitizeStoredBookingData(
	data: PersistedBookingData,
	validAddOnValues: Set<string>,
	validVideoFormatValues: Set<string>,
): PersistedBookingData {
	return {
		...data,
		selectedAddOns: data.selectedAddOns.filter((value) =>
			validAddOnValues.has(value),
		),
		selectedVideoFormat: validVideoFormatValues.has(data.selectedVideoFormat)
			? data.selectedVideoFormat
			: "",
	};
}
