export const BOOKING_MODES = ["single", "package"] as const;

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

export type BookingAddon = (typeof ADDON_OPTIONS)[number];

export type BookingService = (typeof SERVICES)[number];

export const ADDON_GROUPS = [
	["Remote Podcast", "4K UHD Recording", "Teleprompter"],
	["Essential Edit", "Complete Edit"],
	["Clip Volume Pack", "Handcrafted Clips"]
] as const satisfies ReadonlyArray<readonly BookingAddon[]>;

export const EXCLUSIVE_ADDON_GROUPS = ADDON_GROUPS.slice(1);

const CLIP_VOLUME_PACK_EDIT_ADDONS = ["Essential Edit", "Complete Edit"] as const;

// Customer-facing name for Essential Edit is Rough Cut. Internal addon key stays "Essential Edit".
export function getCustomerAddonDisplayLabel(addon: string) {
	if (addon === "Essential Edit") {
		return "Rough Cut";
	}

	return addon;
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

export function filterAddonsAvailableForService(
	service: BookingService | "",
	addons: readonly BookingAddon[]
) {
	return addons.filter((addon) => isAddonAvailableForService(service, addon));
}

export function getPackageSessionAddons(
	packageAddons: readonly BookingAddon[],
	hasRemotePodcast: boolean
): BookingAddon[] {
	const standardSessionAddons = packageAddons.filter((addon) => addon !== "Remote Podcast");

	if (!hasRemotePodcast) {
		return standardSessionAddons;
	}

	return [...standardSessionAddons, "Remote Podcast"];
}

export function satisfiesClipVolumePackEditRequirement(addons: readonly BookingAddon[]) {
	return CLIP_VOLUME_PACK_EDIT_ADDONS.some((addon) => addons.includes(addon));
}

export function isClipVolumePackEditAddon(
	addon: BookingAddon
): addon is (typeof CLIP_VOLUME_PACK_EDIT_ADDONS)[number] {
	return CLIP_VOLUME_PACK_EDIT_ADDONS.some((editAddon) => editAddon === addon);
}

export function resolveExclusiveAddonSelection(
	selectedAddons: readonly BookingAddon[],
	addon: BookingAddon,
	checked: boolean
): BookingAddon[] {
	if (!checked) {
		return selectedAddons.filter((value) => value !== addon);
	}

	const group = EXCLUSIVE_ADDON_GROUPS.find((exclusiveGroup) =>
		exclusiveGroup.some((groupAddon) => groupAddon === addon)
	);

	const siblings = group?.filter((groupAddon) => groupAddon !== addon) ?? [];

	return [...selectedAddons.filter((value) => value !== addon && !siblings.includes(value)), addon];
}

export function isDurationOption(value: string): value is (typeof DURATION_OPTIONS)[number] {
	return DURATION_OPTIONS.some((option) => option === value);
}

export function isDeliverableCountOption(
	value: string | undefined
): value is (typeof DELIVERABLE_COUNT_OPTIONS)[number] {
	return DELIVERABLE_COUNT_OPTIONS.some((option) => option === value);
}

export function toDeliverableCountOption(value: string | undefined) {
	return DELIVERABLE_COUNT_OPTIONS.find((option) => option === value) ?? "";
}
