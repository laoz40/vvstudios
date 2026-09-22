import { useSelector } from "@tanstack/react-store";
import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	useSessionEditDraftStore,
	type SessionEditDraft
} from "#studio/features/admin/lib/session-edit-draft-store";

export type SessionEditPricingFields = Pick<SessionEditDraft, "addons" | "duration"> &
	BookingAddonQuantities;

function getSessionEditPricingFields(draft: SessionEditDraft): SessionEditPricingFields {
	return { addons: draft.addons, duration: draft.duration, ...pickBookingAddonQuantities(draft) };
}

function getSessionEditPricingKey(fields: SessionEditPricingFields): string {
	return [
		fields.duration,
		fields.addons.join("\0"),
		fields.essentialEditQuantity,
		fields.completeEditQuantity,
		fields.clipsPackageQuantity,
		fields.handcraftedClipsQuantity
	].join("|");
}

function areSessionEditPricingFieldsEqual(
	left: SessionEditPricingFields,
	right: SessionEditPricingFields
): boolean {
	return getSessionEditPricingKey(left) === getSessionEditPricingKey(right);
}

export function useSessionEditPricingValues(): SessionEditPricingFields {
	const store = useSessionEditDraftStore();

	return useSelector(store, (draft) => getSessionEditPricingFields(draft), {
		compare: areSessionEditPricingFieldsEqual
	});
}
