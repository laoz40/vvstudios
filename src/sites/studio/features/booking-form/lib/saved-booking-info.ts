import { z } from "zod";
import {
	ADDON_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";

export const SAVED_BOOKING_INFO_STORAGE_KEY = "vvstudios.booking.saved-info";

const availabilityRateLimitKeyStorageKey = "vvstudios.availabilityRateLimitKey";

const timeSectionKeySchema = z.enum(["morning", "afternoon", "evening"]).or(z.literal(""));

export const savedBookingInfoSchema = z.object({
	service: z.union([z.literal(""), z.enum(SERVICES)]),
	duration: z.union([z.literal(""), z.enum(DURATION_OPTIONS)]),
	timeSectionKey: timeSectionKeySchema,
	addons: z.array(z.enum(ADDON_OPTIONS)),
	name: z.string(),
	phone: z.string(),
	accountName: z.string(),
	abn: z.string(),
	email: z.string(),
	notes: z.string(),
});

export type SavedBookingInfo = z.infer<typeof savedBookingInfoSchema>;

export function parseSavedBookingInfo(rawValue: string | null) {
	if (!rawValue) {
		return null;
	}

	try {
		return savedBookingInfoSchema.parse(JSON.parse(rawValue));
	} catch {
		return null;
	}
}

export function toSavedBookingInfo(
	values: BookingFormValues,
	timeSectionKey: SavedBookingInfo["timeSectionKey"],
): SavedBookingInfo {
	return {
		service: values.service,
		duration: values.duration,
		timeSectionKey,
		addons: [...values.addons],
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn ?? "",
		email: values.email,
		notes: values.notes,
	};
}

function getLocalStorage() {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

export function getStoredSavedBookingInfo() {
	try {
		return parseSavedBookingInfo(
			getLocalStorage()?.getItem(SAVED_BOOKING_INFO_STORAGE_KEY) ?? null,
		);
	} catch {
		return null;
	}
}

export function storeSavedBookingInfo(savedBookingInfo: SavedBookingInfo) {
	try {
		getLocalStorage()?.setItem(SAVED_BOOKING_INFO_STORAGE_KEY, JSON.stringify(savedBookingInfo));
	} catch {
		// Ignore storage failures so booking can continue without persistence.
	}
}

export function removeStoredSavedBookingInfo() {
	try {
		getLocalStorage()?.removeItem(SAVED_BOOKING_INFO_STORAGE_KEY);
	} catch {
		// Ignore storage failures so booking can continue without persistence.
	}
}

export function getAvailabilityRateLimitKey() {
	const nextKey = window.crypto.randomUUID();

	try {
		const localStorage = getLocalStorage();
		const existingKey = localStorage?.getItem(availabilityRateLimitKeyStorageKey);

		if (existingKey) {
			return existingKey;
		}

		localStorage?.setItem(availabilityRateLimitKeyStorageKey, nextKey);
	} catch {
		// Ignore storage failures so availability can still load without persistence.
	}

	return nextKey;
}
