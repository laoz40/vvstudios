import { z } from "zod";

export const BOOKING_MODES = ["single", "multi"] as const;
export const SERVICES = ["Table Setup", "Armchair Setup", "Music Setup"] as const;
export const DURATION_OPTIONS = ["1h", "2h", "3h"] as const;
export const ADDON_OPTIONS = [
	"Remote Podcast",
	"4K UHD Recording",
	"Teleprompter",
	"Essential Edit",
	"Complete Edit",
	"Clip Volume Pack",
	"Handcrafted Clips"
] as const;
export const DELIVERABLE_COUNT_OPTIONS = ["1", "2", "3", "4"] as const;
export const ADDON_SECTIONS = [
	{
		title: "Production Add-ons",
		description: "Enhance your recording session.",
		addons: ["Remote Podcast", "4K UHD Recording", "Teleprompter"]
	},
	{
		title: "Editing Services",
		description: "Choose long-form editing services for your content.",
		addons: ["Essential Edit", "Complete Edit"]
	},
	{
		title: "Clip Services",
		description: "Choose short-form clips services for your social media content.",
		addons: ["Clip Volume Pack", "Handcrafted Clips"]
	}
] as const satisfies ReadonlyArray<{
	title: string;
	description: string;
	addons: readonly (typeof ADDON_OPTIONS)[number][];
}>;
export const EXCLUSIVE_ADDON_GROUPS = ADDON_SECTIONS.slice(1).map((section) => section.addons);
const QUANTITY_TRACKED_ADDONS = [
	"Essential Edit",
	"Complete Edit",
	"Clip Volume Pack",
	"Handcrafted Clips"
] as const;
const CLIP_VOLUME_PACK_EDIT_ADDONS = ["Essential Edit", "Complete Edit"] as const;
export type BookingAddonQuantityFieldName =
	| "clipsPackageQuantity"
	| "completeEditQuantity"
	| "essentialEditQuantity"
	| "handcraftedClipsQuantity";

export const BOOKING_ADDON_QUANTITY_FIELD_NAMES = [
	"essentialEditQuantity",
	"completeEditQuantity",
	"clipsPackageQuantity",
	"handcraftedClipsQuantity"
] as const satisfies readonly BookingAddonQuantityFieldName[];

export type BookingAddonQuantities = {
	clipsPackageQuantity?: string;
	completeEditQuantity?: string;
	essentialEditQuantity?: string;
	handcraftedClipsQuantity?: string;
};

export const BOOKING_ADDON_QUANTITY_FIELD_CONFIG = {
	"Essential Edit": {
		fieldName: "essentialEditQuantity",
		requiredMessage: "Number of essential edits is required.",
		labels: { multi: "Number of Essential Edits Per Session", single: "Number of Essential Edits" },
		descriptions: {
			multi:
				"Select how many episodes or projects you want edited for each session. Each Essential Edit adds $99.",
			single: "Charged per episode or project you want edited from this session."
		}
	},
	"Complete Edit": {
		fieldName: "completeEditQuantity",
		requiredMessage: "Number of complete edits is required.",
		labels: { multi: "Number of Complete Edits Per Session", single: "Number of Complete Edits" },
		descriptions: {
			multi:
				"Select how many episodes or projects you want fully edited for each session. Each Complete Edit adds $249.",
			single: "Charged per episode or project you want fully edited from this session."
		}
	},
	"Clip Volume Pack": {
		fieldName: "clipsPackageQuantity",
		requiredMessage: "Number of Clip Volume Packs is required.",
		labels: {
			multi: "Number of Clip Volume Packs Per Session",
			single: "Number of Clip Volume Packs"
		},
		descriptions: {
			multi:
				"Select how many Clip Volume Packs you want for each session. Each 10-clip pack adds $79.",
			single: "One pack includes 10 edited social media clips. Charged per pack."
		}
	},
	"Handcrafted Clips": {
		fieldName: "handcraftedClipsQuantity",
		requiredMessage: "Number of handcrafted clips packs is required.",
		labels: {
			multi: "Number of Handcrafted Clips Packs Per Session",
			single: "Number of Handcrafted Clips Packs"
		},
		descriptions: {
			multi:
				"Select how many Handcrafted Clips packs you want for each session. Each pack adds $199.",
			single: "One pack includes 5 premium edited social media clips. Charged per pack."
		}
	}
} as const satisfies Record<
	(typeof QUANTITY_TRACKED_ADDONS)[number],
	{
		fieldName: BookingAddonQuantityFieldName;
		requiredMessage: string;
		labels: { multi: string; single: string };
		descriptions: { multi: string; single: string };
	}
>;

export function isQuantityTrackedAddon(
	addon: BookingAddon
): addon is (typeof QUANTITY_TRACKED_ADDONS)[number] {
	return QUANTITY_TRACKED_ADDONS.some((quantityTrackedAddon) => quantityTrackedAddon === addon);
}

export function getClearedAddonQuantityUpdates(
	selectedAddons: readonly BookingAddon[]
): Partial<Record<BookingAddonQuantityFieldName, "">> {
	const updates: Partial<Record<BookingAddonQuantityFieldName, "">> = {};

	for (const addon of QUANTITY_TRACKED_ADDONS) {
		const { fieldName } = BOOKING_ADDON_QUANTITY_FIELD_CONFIG[addon];

		if (!selectedAddons.includes(addon)) {
			updates[fieldName] = "";
		}
	}

	return updates;
}

export function forEachClearedAddonQuantityField(
	selectedAddons: readonly BookingAddon[],
	callback: (fieldName: BookingAddonQuantityFieldName, value: "") => void
) {
	const updates = getClearedAddonQuantityUpdates(selectedAddons);

	for (const fieldName of BOOKING_ADDON_QUANTITY_FIELD_NAMES) {
		const value = updates[fieldName];

		if (value !== undefined) {
			callback(fieldName, value);
		}
	}
}

const LEGACY_CLIPS_PACKAGE_ADDON = "Clips Package";
export type BookingAddon = (typeof ADDON_OPTIONS)[number];
export type BookingService = (typeof SERVICES)[number];

export function isAddonOption(value: string): value is BookingAddon {
	return ADDON_OPTIONS.some((option) => option === value);
}

export function normalizeBookingAddon(value: string): BookingAddon | undefined {
	if (value === LEGACY_CLIPS_PACKAGE_ADDON) {
		return "Clip Volume Pack";
	}

	return ADDON_OPTIONS.find((option) => option === value);
}

export function isPackageUnavailableAddon(addon: BookingAddon) {
	return addon === "Remote Podcast";
}

export function isAddonAvailableForService(service: BookingService | "", addon: BookingAddon) {
	if (service !== "Music Setup") {
		return true;
	}

	return addon === "4K UHD Recording" || addon === "Essential Edit";
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
	return addons.some((addon) =>
		QUANTITY_TRACKED_ADDONS.some((quantityTrackedAddon) => quantityTrackedAddon === addon)
	);
}

export function pickBookingAddonQuantities(values: BookingAddonQuantities): BookingAddonQuantities {
	return {
		clipsPackageQuantity: values.clipsPackageQuantity,
		completeEditQuantity: values.completeEditQuantity,
		essentialEditQuantity: values.essentialEditQuantity,
		handcraftedClipsQuantity: values.handcraftedClipsQuantity
	};
}

export function omitEmptyBookingAddonQuantities(
	values: BookingAddonQuantities
): BookingAddonQuantities {
	const quantities: BookingAddonQuantities = {};

	for (const fieldName of BOOKING_ADDON_QUANTITY_FIELD_NAMES) {
		const value = values[fieldName];

		if (value) {
			quantities[fieldName] = value;
		}
	}

	return quantities;
}

export function satisfiesClipVolumePackEditRequirement(addons: readonly BookingAddon[]) {
	return CLIP_VOLUME_PACK_EDIT_ADDONS.some((addon) => addons.includes(addon));
}

export function isClipVolumePackEditAddon(
	addon: BookingAddon
): addon is (typeof CLIP_VOLUME_PACK_EDIT_ADDONS)[number] {
	return CLIP_VOLUME_PACK_EDIT_ADDONS.some((editAddon) => editAddon === addon);
}

function findExclusiveAddonGroup(addon: BookingAddon) {
	return EXCLUSIVE_ADDON_GROUPS.find((group) => group.some((groupAddon) => groupAddon === addon));
}

function getExclusiveAddonSiblings(addon: BookingAddon): readonly BookingAddon[] {
	const group = findExclusiveAddonGroup(addon);

	if (!group) {
		return [];
	}

	return group.filter((groupAddon) => groupAddon !== addon);
}

export function resolveExclusiveAddonSelection(
	selectedAddons: readonly BookingAddon[],
	addon: BookingAddon,
	checked: boolean
): BookingAddon[] {
	if (!checked) {
		return selectedAddons.filter((value) => value !== addon);
	}

	const siblings = getExclusiveAddonSiblings(addon);

	return [...selectedAddons.filter((value) => value !== addon && !siblings.includes(value)), addon];
}

export function isDeliverableCountOption(
	value: string | undefined
): value is (typeof DELIVERABLE_COUNT_OPTIONS)[number] {
	return DELIVERABLE_COUNT_OPTIONS.some((option) => option === value);
}

export function toDeliverableCountOption(value: string | undefined) {
	return DELIVERABLE_COUNT_OPTIONS.find((option) => option === value) ?? "";
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

export const GMAIL_REQUIRED_MESSAGE = "A Gmail address is required.";

export function shouldPromptGmailAddress(emailValue: string) {
	const trimmed = emailValue.trim();
	const atIndex = trimmed.lastIndexOf("@");

	if (atIndex <= 0 || atIndex === trimmed.length - 1) {
		return false;
	}

	return trimmed.slice(atIndex + 1).toLowerCase() !== "gmail.com";
}

const bookingMode = z
	.union([z.literal(""), z.enum(BOOKING_MODES)])
	.refine((value) => value !== "", { message: "Booking type is required." });
const duration = z
	.union([z.literal(""), z.enum(DURATION_OPTIONS)])
	.refine((value) => value !== "", "Duration is required.");

export function isDurationOption(value: string): value is (typeof DURATION_OPTIONS)[number] {
	return DURATION_OPTIONS.some((option) => option === value);
}

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
	completeEditQuantity: deliverableCountOption.optional(),
	clipsPackageQuantity: deliverableCountOption.optional(),
	handcraftedClipsQuantity: deliverableCountOption.optional(),
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
			message: "Essential Edit or Complete Edit is required with the Clip Volume Pack.",
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
		packageSize: optionalMultiBookingSize,
		date: z.string(),
		time: z.string()
	})
	.superRefine((values, ctx) => {
		validateExclusiveAddonGroups(values, ctx);
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

export const publicBookingSchema = bookingSchema.superRefine((values, ctx) => {
	if (shouldPromptGmailAddress(values.email)) {
		ctx.addIssue({ code: "custom", message: GMAIL_REQUIRED_MESSAGE, path: ["email"] });
	}
});

export const multiBookingFormSchema = z
	.object({ ...sharedBookingFields, packageSize: requiredMultiBookingSize })
	.superRefine((values, ctx) => {
		validateExclusiveAddonGroups(values, ctx);
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
	completeEditQuantity: "",
	clipsPackageQuantity: "",
	handcraftedClipsQuantity: "",
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
