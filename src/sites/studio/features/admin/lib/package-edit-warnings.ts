import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import type { PackageEditDraft } from "#studio/features/admin/components/PackageEditDialog";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";

export type PackageEditWarningField = keyof PackageEditDraft;

const pricingFields: readonly PackageEditWarningField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"completeEditQuantity",
	"clipsPackageQuantity",
	"handcraftedClipsQuantity",
	"packageSize",
	"totalDueAmount"
];

const packageEditFieldLabels: Record<PackageEditWarningField, string> = {
	abn: "ABN",
	accountName: "Account name",
	addons: "Add-ons",
	clipsPackageQuantity: "Clip Volume Pack quantity",
	completeEditQuantity: "Complete Edit quantity",
	customerEmail: "Customer email",
	customerName: "Customer name",
	customerPhone: "Phone number",
	duration: "Session duration",
	essentialEditQuantity: "Essential Edit quantity",
	handcraftedClipsQuantity: "Handcrafted Clips quantity",
	expiresAt: "Package expiry window",
	notes: "Notes",
	packageSize: "Package sessions",
	totalDueAmount: "Package total due"
};

function isPackageEditWarningField(field: string): field is PackageEditWarningField {
	return Object.hasOwn(packageEditFieldLabels, field);
}

function didArrayChange(currentValue: readonly string[], nextValue: readonly string[]) {
	if (currentValue.length !== nextValue.length) {
		return true;
	}

	return currentValue.some((value, index) => value !== nextValue[index]);
}

function getPackageDraftValue(packageRow: AdminPackageRow, field: PackageEditWarningField) {
	if (
		field === "abn" ||
		field === "notes" ||
		field === "essentialEditQuantity" ||
		field === "completeEditQuantity" ||
		field === "clipsPackageQuantity" ||
		field === "handcraftedClipsQuantity"
	) {
		return packageRow[field] ?? "";
	}

	if (field === "expiresAt") {
		return packageRow.expiresAt ?? undefined;
	}

	if (field === "totalDueAmount") {
		return packageRow.totalDueAmount;
	}

	return packageRow[field];
}

function getPackageTotalDueDraftValue(draft: PackageEditDraft) {
	const totalDueDraft = draft.totalDueAmount.trim();

	if (totalDueDraft.length > 0) {
		return Number(totalDueDraft);
	}

	return calculatePackageAmounts({
		addons: draft.addons,
		duration: draft.duration,
		packageSize: draft.packageSize,
		...pickBookingAddonQuantities(draft)
	}).totalDueAmount;
}

function didPackageEditFieldChange(
	packageRow: AdminPackageRow,
	draft: PackageEditDraft,
	field: PackageEditWarningField
) {
	const currentValue = getPackageDraftValue(packageRow, field);
	const nextValue = field === "totalDueAmount" ? getPackageTotalDueDraftValue(draft) : draft[field];

	if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
		return didArrayChange(currentValue, nextValue);
	}

	return (currentValue ?? undefined) !== (nextValue ?? undefined);
}

function getChangedFieldLabels(
	changedFields: PackageEditWarningField[],
	warningFields: readonly PackageEditWarningField[]
) {
	return changedFields
		.filter((field) => warningFields.includes(field))
		.map((field) => packageEditFieldLabels[field]);
}

export function getPackageEditWarningState(packageRow: AdminPackageRow, draft: PackageEditDraft) {
	const changedFields = Object.keys(draft)
		.filter(isPackageEditWarningField)
		.filter((field) => didPackageEditFieldChange(packageRow, draft, field));
	const pricingFieldLabels = getChangedFieldLabels(changedFields, pricingFields);

	const manualPriceWillBeUsed = draft.totalDueAmount.trim().length > 0;

	return {
		changedFieldLabels: changedFields.map((field) => packageEditFieldLabels[field]),
		manualPriceWillBeUsed,
		pricingFieldLabels,
		requiresConfirmation: changedFields.length > 0
	};
}
