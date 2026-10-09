import { z } from "zod";
import { bookingPhoneSchema } from "#studio/features/booking-form/lib/booking-phone";
import {
	ADDON_OPTIONS,
	ADDON_GROUPS,
	BOOKING_MODES,
	DELIVERABLE_COUNT_OPTIONS,
	DURATION_OPTIONS,
	EXCLUSIVE_ADDON_GROUPS,
	SERVICES,
	isPackageUnavailableAddon,
	satisfiesClipVolumePackEditRequirement,
	type BookingAddon
} from "#/domain/booking/catalog";
import {
	BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON,
	QUANTITY_TRACKED_ADDONS,
	type BookingAddonQuantityFieldName,
	type BookingAddonQuantities,
	type QuantityTrackedAddon
} from "#/domain/booking/addon-quantities";

export const ADDON_SECTIONS = [
	{ title: "Production Add-ons", addons: ADDON_GROUPS[0] },
	{ title: "Editing Services", addons: ADDON_GROUPS[1] },
	{ title: "Clip Services", addons: ADDON_GROUPS[2] }
] as const;

export const BOOKING_ADDON_QUANTITY_FIELD_CONFIG = {
	"Essential Edit": {
		fieldName: BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Essential Edit"],
		requiredMessage: "Choose how many episodes or videos you want edited.",
		priceUnit: "video",
		unitLabels: { single: "episode / video", plural: "episodes / videos" },
		labels: {
			multi: "How many episodes or videos would you like edited per session?",
			single: "How many episodes or videos would you like edited?"
		},
		description: null
	},
	"Complete Edit": {
		fieldName: BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Complete Edit"],
		requiredMessage: "Choose how many episodes or videos you want fully edited.",
		priceUnit: "video",
		unitLabels: { single: "episode / video", plural: "episodes / videos" },
		labels: {
			multi: "How many episodes or videos would you like fully edited per session?",
			single: "How many episodes or videos would you like fully edited?"
		},
		description: null
	},
	"Clip Volume Pack": {
		fieldName: BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Clip Volume Pack"],
		requiredMessage: "Choose how many Clip Volume Packs you want.",
		priceUnit: "pack",
		unitLabels: { single: "pack", plural: "packs" },
		labels: {
			multi: "How many clip packs would you like per session?",
			single: "How many clip packs would you like?"
		},
		description: "10 clips per pack"
	},
	"Handcrafted Clips": {
		fieldName: BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Handcrafted Clips"],
		requiredMessage: "Choose how many Handcrafted Clips packs you want.",
		priceUnit: "pack",
		unitLabels: { single: "pack", plural: "packs" },
		labels: {
			multi: "How many handcrafted clip packs would you like per session?",
			single: "How many handcrafted clip packs would you like?"
		},
		description: "5 clips per pack"
	}
} as const satisfies Record<
	QuantityTrackedAddon,
	{
		fieldName: BookingAddonQuantityFieldName;
		requiredMessage: string;
		priceUnit: string;
		unitLabels: { single: string; plural: string };
		labels: { multi: string; single: string };
		description: string | null;
	}
>;

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

const phone = bookingPhoneSchema;

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

const requiredPackageSize = z.union([z.literal(4), z.literal(8), z.literal(12)]);

const optionalPackageSize = z.union([z.literal(""), requiredPackageSize]);

const quantityBookingFields = {
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Essential Edit"]]: deliverableCountOption.optional(),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Complete Edit"]]: deliverableCountOption.optional(),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Clip Volume Pack"]]: deliverableCountOption.optional(),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Handcrafted Clips"]]: deliverableCountOption.optional()
};

const sharedBookingFields = {
	name,
	phone,
	accountName,
	abn,
	email,
	duration,
	addons,
	...quantityBookingFields,
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

function validateExclusiveAddonGroups(
	values: { addons: readonly BookingAddon[] },
	ctx: z.RefinementCtx
) {
	for (const group of EXCLUSIVE_ADDON_GROUPS) {
		const selectedInGroup = group.filter((groupAddon) => values.addons.includes(groupAddon));

		if (selectedInGroup.length > 1) {
			ctx.addIssue({
				code: "custom",
				message: `Select only one of: ${group.join(" or ")}.`,
				path: ["addons"]
			});
		}
	}
}

function validateEditingAddonQuantities(
	values: { addons: readonly BookingAddon[] } & BookingAddonQuantities,
	ctx: z.RefinementCtx
) {
	if (
		values.addons.includes("Clip Volume Pack") &&
		!satisfiesClipVolumePackEditRequirement(values.addons)
	) {
		ctx.addIssue({
			code: "custom",
			message: "Rough Cut or Complete Edit is required with the Clip Volume Pack.",
			path: ["addons"]
		});
	}

	// Quantity-tracked add-ons are charged independently, so each selected add-on
	// must have its own quantity instead of sharing one deliverable count.
	for (const addon of QUANTITY_TRACKED_ADDONS) {
		const { fieldName, requiredMessage } = BOOKING_ADDON_QUANTITY_FIELD_CONFIG[addon];

		if (values.addons.includes(addon) && !values[fieldName]) {
			ctx.addIssue({ code: "custom", message: requiredMessage, path: [fieldName] });
		}
	}
}

export const bookingSchema = z
	.object({
		...sharedBookingFields,
		service,
		bookingMode,
		packageSize: optionalPackageSize,
		date: z.string(),
		time: z.string()
	})
	.superRefine((values, ctx) => {
		validateExclusiveAddonGroups(values, ctx);
		validateEditingAddonQuantities(values, ctx);

		if (values.bookingMode === "package" && !values.packageSize) {
			ctx.addIssue({ code: "custom", message: "Package size is required.", path: ["packageSize"] });
		}

		if (values.bookingMode === "package") {
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

export const publicBookingSchema = bookingSchema;

function getBookingFieldBlurError(
	fieldName: keyof BookingFormValues,
	formValues: BookingFormValues
): string | undefined {
	const validationResult = publicBookingSchema.safeParse(formValues);

	if (validationResult.success) {
		return undefined;
	}

	const issue = validationResult.error.issues.find((entry) => entry.path[0] === fieldName);

	return issue?.message;
}

export function bookingFieldBlurValidator(fieldName: keyof BookingFormValues) {
	return {
		onBlur: ({ fieldApi }: { fieldApi: { form: { state: { values: BookingFormValues } } } }) =>
			getBookingFieldBlurError(fieldName, fieldApi.form.state.values)
	};
}

export const packageFormSchema = z
	.object({ ...sharedBookingFields, packageSize: requiredPackageSize })
	.superRefine((values, ctx) => {
		validateExclusiveAddonGroups(values, ctx);
		validateEditingAddonQuantities(values, ctx);
		validatePackageAddonAvailability(values, ctx);
	});

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
	completeEditQuantity: "",
	clipsPackageQuantity: "",
	handcraftedClipsQuantity: "",
	notes: ""
};

export function toFieldErrorObjects(errors: unknown[]) {
	const fieldErrorMessageSchema = z.object({ message: z.string() });

	return errors.flatMap((error) => {
		if (!error) {
			return [];
		}

		const stringError = z.string().safeParse(error);

		if (stringError.success) {
			return [{ message: stringError.data }];
		}

		const fieldError = fieldErrorMessageSchema.safeParse(error);

		return fieldError.success ? [fieldError.data] : [];
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
