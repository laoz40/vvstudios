import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import type { PackageEditDraft } from "#studio/features/admin/components/PackageEditDialog";
import { calculateMultiBookingAmounts } from "#studio/features/booking-form/lib/booking-pricing";

export type PackageEditWarningField = keyof PackageEditDraft;

const pricingFields: readonly PackageEditWarningField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
	"packageSize",
	"totalDueAmount"
];

const packageEditFieldLabels: Record<PackageEditWarningField, string> = {
	abn: "ABN",
	accountName: "Account name",
	addons: "Add-ons",
	clipsPackageQuantity: "Clips Package quantity",
	customerEmail: "Customer email",
	customerName: "Customer name",
	customerPhone: "Phone number",
	duration: "Session duration",
	essentialEditQuantity: "Essential Edit quantity",
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
		field === "clipsPackageQuantity"
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

	return calculateMultiBookingAmounts({
		addons: draft.addons,
		clipsPackageQuantity: draft.clipsPackageQuantity,
		duration: draft.duration,
		essentialEditQuantity: draft.essentialEditQuantity,
		packageSize: draft.packageSize
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
