export const LEGACY_CLIPS_PACKAGE_ADDON = "Clips Package";
export const CLIP_VOLUME_PACK_ADDON = "Clip Volume Pack";

export function renameClipsPackageInAddons(addons: readonly string[]) {
	const nextAddons: string[] = [];
	let changed = false;

	for (const addon of addons) {
		const normalizedAddon = addon === LEGACY_CLIPS_PACKAGE_ADDON ? CLIP_VOLUME_PACK_ADDON : addon;

		if (normalizedAddon !== addon) {
			changed = true;
		}

		if (nextAddons.includes(normalizedAddon)) {
			continue;
		}

		nextAddons.push(normalizedAddon);
	}

	if (!changed && nextAddons.length === addons.length) {
		return { addons: [...addons], changed: false };
	}

	return { addons: nextAddons, changed: true };
}

export function hasLegacyClipsPackageAddon(addons: readonly string[]) {
	return addons.includes(LEGACY_CLIPS_PACKAGE_ADDON);
}
