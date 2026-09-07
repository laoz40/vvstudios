import {
	ADDON_OPTIONS,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";

export const LEGACY_CLIPS_PACKAGE_ADDON = "Clips Package";
export const CLIP_VOLUME_PACK_ADDON = "Clip Volume Pack";

export function renameClipsPackageInAddons(addons: readonly string[]) {
	const nextAddons: BookingAddon[] = [];
	let changed = false;

	for (const addon of addons) {
		const renamedAddon = addon === LEGACY_CLIPS_PACKAGE_ADDON ? CLIP_VOLUME_PACK_ADDON : addon;

		if (renamedAddon !== addon) {
			changed = true;
		}

		const bookingAddon = ADDON_OPTIONS.find((option) => option === renamedAddon);
		if (bookingAddon === undefined) {
			changed = true;
			continue;
		}

		if (nextAddons.includes(bookingAddon)) {
			continue;
		}

		nextAddons.push(bookingAddon);
	}

	if (!changed && nextAddons.length === addons.length) {
		return { addons: [...nextAddons], changed: false };
	}

	return { addons: nextAddons, changed: true };
}

export function hasLegacyClipsPackageAddon(addons: readonly string[]) {
	return addons.includes(LEGACY_CLIPS_PACKAGE_ADDON);
}
