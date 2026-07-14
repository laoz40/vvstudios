import { z } from "zod";

export const BOOKING_MODES = ["single", "multi"] as const;
export const SERVICES = ["Table Setup", "Armchair Setup"] as const;
export const DURATION_OPTIONS = ["1h", "2h", "3h"] as const;
export const ADDON_OPTIONS = [
	"Remote Podcast",
	"4K UHD Recording",
	"Teleprompter",
	"Essential Edit",
	"Clips Package"
] as const;
export const DELIVERABLE_COUNT_OPTIONS = ["1", "2", "3", "4"] as const;
const EDITING_ADDONS = ["Essential Edit", "Clips Package"] as const;
export type BookingAddon = (typeof ADDON_OPTIONS)[number];

export function isAddonOption(value: string): value is BookingAddon {
	return ADDON_OPTIONS.includes(value as BookingAddon);
}

export function isPackageUnavailableAddon(addon: BookingAddon) {
	return addon === "Remote Podcast";
}

export function getPackageSessionAddons(
	packageAddons: readonly string[],
	hasRemotePodcast: boolean
): string[] {
	const standardSessionAddons = packageAddons.filter((addon) => addon !== "Remote Podcast");

	if (!hasRemotePodcast) {
		return standardSessionAddons;
	}

	return [...standardSessionAddons, "Remote Podcast"];
}

export function hasEditingAddon(addons: readonly BookingAddon[]) {
	return addons.some((addon) => EDITING_ADDONS.includes(addon as (typeof EDITING_ADDONS)[number]));
}

export function toDeliverableCountOption(value: string | undefined) {
	return DELIVERABLE_COUNT_OPTIONS.includes(value as (typeof DELIVERABLE_COUNT_OPTIONS)[number])
		? (value as (typeof DELIVERABLE_COUNT_OPTIONS)[number])
		: "";
}

const name = z
	.string()
	.trim()
	.min(1, "Full name is required.")
	.pipe(
		z
			.string()
			.max(50, "Name must be 50 characters or fewer.")
			.regex(/^[\p{L}\p{M}' ,-]+$/u, "Name contains invalid characters.")
	);

const phone = z
	.string()
	.trim()
	.min(1, "Phone number is required.")
	.pipe(z.string().regex(/^[\d\s().+-]{6,20}$/, "Please enter a valid phone number."));

const accountName = z
	.string()
	.trim()
	.min(1, "Account name is required.")
	.pipe(
		z
			.string()
			.max(50, "Account name must be 50 characters or fewer.")
			.regex(/^[\p{L}\p{M}' ,.()-]+$/u, "Account name contains invalid characters.")
	);

const abn = z
	.string()
	.trim()
	.transform((value) => (value === "" ? undefined : value))
	.optional()
	.transform((value) => value?.replace(/\s+/g, ""))
	.refine((value) => !value || /^\d{11}$/.test(value), {
		message: "ABN must be exactly 11 digits."
	});

const email = z
	.string()
	.trim()
	.min(1, "Email is required.")
	.pipe(z.email("Please enter a valid email address."));

const bookingMode = z
	.union([z.literal(""), z.enum(BOOKING_MODES)])
	.refine((value) => value !== "", { message: "Booking type is required." });
const duration = z
	.union([z.literal(""), z.enum(DURATION_OPTIONS)])
	.refine((value) => value !== "", "Duration is required.");

export const recordingSpaceSchema = z.enum(SERVICES);
const service = z.union([z.literal(""), recordingSpaceSchema]);

const deliverableCountOption = z.union([z.literal(""), z.enum(DELIVERABLE_COUNT_OPTIONS)]);
const addons = z
	.array(z.enum(ADDON_OPTIONS))
	.refine((value) => new Set(value).size === value.length, {
		message: "Duplicate add-ons are not allowed."
	});
const notes = z.string().trim().max(200, "Please keep this under 200 characters.");
const requiredMultiBookingSize = z.union([z.literal(4), z.literal(8), z.literal(12)]);
const optionalMultiBookingSize = z.union([z.literal(""), requiredMultiBookingSize]);

const sharedBookingFields = {
	name,
	phone,
	accountName,
	abn,
	email,
	duration,
	addons,
	essentialEditQuantity: deliverableCountOption.optional(),
	clipsPackageQuantity: deliverableCountOption.optional(),
	notes
};

function validatePackageAddonAvailability(
	values: { addons: readonly BookingAddon[] },
	ctx: z.RefinementCtx
) {
	if (values.addons.some(isPackageUnavailableAddon)) {
		ctx.addIssue({
			code: "custom",
			message: "Remote Podcast is selected per session when scheduling your package.",
			path: ["addons"]
		});
	}
}

function validateEditingAddonQuantities(
	values: {
		addons: readonly BookingAddon[];
		essentialEditQuantity?: string;
		clipsPackageQuantity?: string;
	},
	ctx: z.RefinementCtx
) {
	// Editing add-ons are charged independently, so each selected editing add-on
	// must have its own quantity instead of sharing one deliverable count.
	if (values.addons.includes("Essential Edit") && !values.essentialEditQuantity) {
		ctx.addIssue({
			code: "custom",
			message: "Number of essential edits is required.",
			path: ["essentialEditQuantity"]
		});
	}

	if (values.addons.includes("Clips Package") && !values.clipsPackageQuantity) {
		ctx.addIssue({
			code: "custom",
			message: "Number of clips packages is required.",
			path: ["clipsPackageQuantity"]
		});
	}
}

export const bookingSchema = z
	.object({
		...sharedBookingFields,
		service,
		bookingMode,
		packageSize: optionalMultiBookingSize,
		date: z.string(),
		time: z.string()
	})
	.superRefine((values, ctx) => {
		validateEditingAddonQuantities(values, ctx);

		if (values.bookingMode === "multi" && !values.packageSize) {
			ctx.addIssue({ code: "custom", message: "Package size is required.", path: ["packageSize"] });
		}

		if (values.bookingMode === "multi") {
			validatePackageAddonAvailability(values, ctx);
		}

		if (values.bookingMode !== "single") {
			return;
		}

		if (!values.date) {
			ctx.addIssue({ code: "custom", message: "Date is required.", path: ["date"] });
		}

		if (!values.time) {
			ctx.addIssue({ code: "custom", message: "Time is required.", path: ["time"] });
		}

		if (!values.service) {
			ctx.addIssue({ code: "custom", message: "Recording space is required.", path: ["service"] });
		}
	});

export type BookingFormValues = z.input<typeof bookingSchema>;

export const multiBookingFormSchema = z
	.object({ ...sharedBookingFields, packageSize: requiredMultiBookingSize })
	.superRefine((values, ctx) => {
		validateEditingAddonQuantities(values, ctx);
		validatePackageAddonAvailability(values, ctx);
	});

export type MultiBookingFormValues = z.input<typeof multiBookingFormSchema>;

export const INITIAL_FORM: BookingFormValues = {
	name: "",
	phone: "",
	accountName: "",
	abn: "",
	email: "",
	bookingMode: "single",
	packageSize: "",
	date: "",
	time: "",
	duration: "",
	service: "",
	addons: [],
	essentialEditQuantity: "",
	clipsPackageQuantity: "",
	notes: ""
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

export interface BookingTimeSelectionMessage {
	text: string;
	variant: "default" | "error";
}

export function getBookingTimeSelectionMessage({
	hasDate,
	hasDuration,
	isViewingSelectedMonth
}: {
	hasDate: boolean;
	hasDuration: boolean;
	isViewingSelectedMonth: boolean;
}): BookingTimeSelectionMessage | null {
	if (!hasDate || !isViewingSelectedMonth) {
		return { text: "Select a date to view times.", variant: "default" };
	}

	if (!hasDuration) {
		return { text: "Select a duration to view times.", variant: "error" };
	}

	return null;
}
