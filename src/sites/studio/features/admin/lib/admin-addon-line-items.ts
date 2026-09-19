import {
	ADDON_OPTIONS,
	ADDON_SECTIONS,
	BOOKING_ADDON_QUANTITY_FIELD_CONFIG,
	DELIVERABLE_COUNT_OPTIONS,
	getClearedAddonQuantityUpdates,
	isDeliverableCountOption,
	isQuantityTrackedAddon,
	pickBookingAddonQuantities,
	resolveExclusiveAddonSelection,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";

export type AdminAddonLineItemDraft = { id: string; addon: BookingAddon | ""; quantity: string };

export function createAdminAddonLineItemDraft(): AdminAddonLineItemDraft {
	return { id: crypto.randomUUID(), addon: "", quantity: "" };
}

function getExclusiveAddonSiblings(addon: BookingAddon): readonly BookingAddon[] {
	for (const section of ADDON_SECTIONS.slice(1)) {
		if (section.addons.some((sectionAddon) => sectionAddon === addon)) {
			return section.addons.filter((sectionAddon) => sectionAddon !== addon);
		}
	}

	return [];
}

export function adminAddonLineItemsFromState(
	addons: readonly BookingAddon[],
	quantities: BookingAddonQuantities
): AdminAddonLineItemDraft[] {
	if (addons.length === 0) {
		return [createAdminAddonLineItemDraft()];
	}

	return addons.map((addon) => {
		const quantityField = isQuantityTrackedAddon(addon)
			? BOOKING_ADDON_QUANTITY_FIELD_CONFIG[addon].fieldName
			: null;

		return {
			id: crypto.randomUUID(),
			addon,
			quantity: quantityField ? (quantities[quantityField] ?? "") : ""
		};
	});
}

export function adminAddonStateFromLineItems(
	drafts: readonly AdminAddonLineItemDraft[]
): { addons: BookingAddon[] } & BookingAddonQuantities {
	let addons: BookingAddon[] = [];
	const quantities: BookingAddonQuantities = {};

	for (const draft of drafts) {
		if (draft.addon === "") {
			continue;
		}

		addons = resolveExclusiveAddonSelection(addons, draft.addon, true);

		if (!isQuantityTrackedAddon(draft.addon)) {
			continue;
		}

		const { fieldName } = BOOKING_ADDON_QUANTITY_FIELD_CONFIG[draft.addon];

		if (isDeliverableCountOption(draft.quantity)) {
			quantities[fieldName] = draft.quantity;
		}
	}

	return {
		addons,
		...pickBookingAddonQuantities(quantities),
		...getClearedAddonQuantityUpdates(addons)
	};
}

export function getAdminAddonLineItemOptions(
	drafts: readonly AdminAddonLineItemDraft[],
	currentDraftId: string
) {
	const currentDraft = drafts.find((draft) => draft.id === currentDraftId);

	const otherSelectedAddons = drafts.flatMap((draft) =>
		draft.id !== currentDraftId && draft.addon !== "" ? [draft.addon] : []
	);

	return ADDON_OPTIONS.filter((addon) => {
		if (currentDraft?.addon === addon) {
			return true;
		}

		if (otherSelectedAddons.includes(addon)) {
			return false;
		}

		return !otherSelectedAddons.some((selectedAddon) =>
			getExclusiveAddonSiblings(addon).includes(selectedAddon)
		);
	});
}

export function isAdminAddonLineItemQuantityDisabled(draft: AdminAddonLineItemDraft) {
	return draft.addon === "" || !isQuantityTrackedAddon(draft.addon);
}

export function getAdminAddonLineItemQuantityValue(draft: AdminAddonLineItemDraft) {
	if (isAdminAddonLineItemQuantityDisabled(draft)) {
		return "1";
	}

	return draft.quantity;
}

export function isAdminAddonQuantity(
	value: string
): value is (typeof DELIVERABLE_COUNT_OPTIONS)[number] {
	return isDeliverableCountOption(value);
}
