import { z } from "zod";

export const SERVICES = ["Table Setup", "Armchair Setup"] as const;
export const DURATION_OPTIONS = ["1h", "2h", "3h"] as const;
export const ADDON_OPTIONS = [
	"Remote Podcast",
	"4K UHD Recording",
	"Essential Edit",
	"Clips Package",
] as const;
export const DELIVERABLE_COUNT_OPTIONS = ["1", "2", "3", "4"] as const;
export const EDITING_ADDONS = ["Essential Edit", "Clips Package"] as const;
export const TIME_SECTIONS = [
	{
		key: "morning",
		label: "Morning",
		includes: (time: string) => time < "12:00",
	},
	{
		key: "afternoon",
		label: "Afternoon",
		includes: (time: string) => time >= "12:00" && time < "17:00",
	},
	{
		key: "evening",
		label: "Evening",
		includes: (time: string) => time >= "17:00",
	},
] as const;

export type BookingAddon = (typeof ADDON_OPTIONS)[number];
export type TimeSectionKey = (typeof TIME_SECTIONS)[number]["key"];

export function hasEditingAddon(addons: readonly BookingAddon[]) {
	return addons.some((addon) => EDITING_ADDONS.includes(addon as (typeof EDITING_ADDONS)[number]));
}

export function toDeliverableCountOption(value: string | undefined) {
	return DELIVERABLE_COUNT_OPTIONS.includes(value as (typeof DELIVERABLE_COUNT_OPTIONS)[number])
		? (value as (typeof DELIVERABLE_COUNT_OPTIONS)[number])
		: "";
}

export const bookingSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, "Full name is required.")
			.pipe(
				z
					.string()
					.max(50, "Name must be 50 characters or fewer.")
					.regex(/^[\p{L}\p{M}' ,-]+$/u, "Name contains invalid characters."),
			),
		phone: z
			.string()
			.trim()
			.min(1, "Phone number is required.")
			.pipe(z.string().regex(/^[\d\s().+-]{6,20}$/, "Please enter a valid phone number.")),
		accountName: z
			.string()
			.trim()
			.min(1, "Account name is required.")
			.pipe(
				z
					.string()
					.max(50, "Account name must be 50 characters or fewer.")
					.regex(/^[\p{L}\p{M}' ,.()-]+$/u, "Account name contains invalid characters."),
			),
		abn: z
			.string()
			.trim()
			.transform((value) => (value === "" ? undefined : value))
			.optional()
			.transform((value) => value?.replace(/\s+/g, ""))
			.refine((value) => !value || /^\d{11}$/.test(value), {
				message: "ABN must be exactly 11 digits.",
			}),
		email: z
			.string()
			.trim()
			.min(1, "Email is required.")
			.pipe(z.email("Please enter a valid email address.")),
		date: z.string().min(1, "Date is required."),
		time: z.string().min(1, "Time is required."),
		duration: z
			.union([z.literal(""), z.enum(DURATION_OPTIONS)])
			.refine((value) => value !== "", "Duration is required."),
		service: z
			.union([z.literal(""), z.enum(SERVICES)])
			.refine((value) => value !== "", "Recording space is required."),
		addons: z.array(z.enum(ADDON_OPTIONS)),
		deliverableCount: z.union([z.literal(""), z.enum(DELIVERABLE_COUNT_OPTIONS)]).optional(),
		notes: z.string().trim().max(200, "Please keep this under 200 characters."),
	})
	.superRefine((values, ctx) => {
		// Check the selected add-ons for editing add-ons
		// These are charged per deliverable, so the form cannot be submitted
		// unless the customer also selects how many deliverables they need.
		const needsDeliverableCount = hasEditingAddon(values.addons);

		if (needsDeliverableCount && !values.deliverableCount) {
			ctx.addIssue({
				code: "custom",
				message: "Number of deliverables is required for editing add-ons.",
				path: ["deliverableCount"],
			});
		}
	});

export type BookingFormValues = z.input<typeof bookingSchema>;
export type ParsedBookingFormValues = z.output<typeof bookingSchema>;

export interface AvailableTimeSection {
	key: TimeSectionKey;
	label: string;
	times: string[];
}

export const INITIAL_FORM: BookingFormValues = {
	name: "",
	phone: "",
	accountName: "",
	abn: "",
	email: "",
	date: "",
	time: "",
	duration: "",
	service: "",
	addons: [],
	deliverableCount: "",
	notes: "",
};

export function toFieldErrorObjects(errors: unknown[]) {
	return errors.flatMap((error) => {
		if (!error) {
			return [];
		}

		if (typeof error === "string") {
			return [{ message: error }];
		}

		if (typeof error === "object" && "message" in error) {
			const message = error.message;
			return typeof message === "string" ? [{ message }] : [];
		}

		return [];
	});
}
