import { useSelector } from "@tanstack/react-store";
import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	usePackageEditDraftStore,
	type PackageEditDraft
} from "#studio/features/admin/lib/package-edit-draft-store";

export type PackageEditPricingFields = Pick<
	PackageEditDraft,
	"addons" | "duration" | "packageSize"
> &
	BookingAddonQuantities;

function getPackageEditPricingFields(draft: PackageEditDraft): PackageEditPricingFields {
	return {
		addons: draft.addons,
		duration: draft.duration,
		packageSize: draft.packageSize,
		...pickBookingAddonQuantities(draft)
	};
}

function getPackageEditPricingKey(fields: PackageEditPricingFields): string {
	return [
		fields.duration,
		fields.packageSize,
		fields.addons.join("\0"),
		fields.essentialEditQuantity,
		fields.completeEditQuantity,
		fields.clipsPackageQuantity,
		fields.handcraftedClipsQuantity
	].join("|");
}

function arePackageEditPricingFieldsEqual(
	left: PackageEditPricingFields,
	right: PackageEditPricingFields
): boolean {
	return getPackageEditPricingKey(left) === getPackageEditPricingKey(right);
}

export function usePackageEditPricingValues(): PackageEditPricingFields {
	const store = usePackageEditDraftStore();

	return useSelector(store, (draft) => getPackageEditPricingFields(draft), {
		compare: arePackageEditPricingFieldsEqual
	});
}
