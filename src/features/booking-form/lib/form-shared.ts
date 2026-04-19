import { z } from "zod";

export const SERVICES = ["Table Setup", "Open Setup"] as const;
export const DURATION_OPTIONS = ["1h", "2h", "3h"] as const;
export const ADDON_OPTIONS = [
	"4K UHD Recording",
	"Video Editing",
	"10 Social Media Clips",
] as const;
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

export const bookingSchema = z.object({
	name: z.string().trim().min(2, "Name is required."),
	email: z.email("Enter a valid email address.").trim(),
	date: z.string().min(1, "Date is required."),
	time: z.string().min(1, "Time is required."),
	duration: z
		.union([z.literal(""), z.enum(DURATION_OPTIONS)])
		.refine((value) => value !== "", "Duration is required."),
	service: z
		.union([z.literal(""), z.enum(SERVICES)])
		.refine((value) => value !== "", "Service is required."),
	addons: z.array(z.enum(ADDON_OPTIONS)),
	notes: z.string(),
});

export type BookingFormValues = z.input<typeof bookingSchema>;
export type ParsedBookingFormValues = z.output<typeof bookingSchema>;

export interface AvailableTimeSection {
	key: string;
	label: string;
	times: string[];
}

export const INITIAL_FORM: BookingFormValues = {
	name: "",
	email: "",
	date: "",
	time: "",
	duration: "",
	service: "",
	addons: [],
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
