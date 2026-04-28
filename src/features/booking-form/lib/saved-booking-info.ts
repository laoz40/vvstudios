import { z } from "zod";
import {
	ADDON_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
	type BookingFormValues,
} from "#/features/booking-form/lib/form-shared";

export const SAVED_BOOKING_INFO_STORAGE_KEY = "vvstudios.booking.saved-info";

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
		abn: values.abn,
		email: values.email,
		notes: values.notes,
	};
}
