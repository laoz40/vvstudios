import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import type { PackageEditDraft } from "#studio/features/admin/lib/package-edit-draft-store";
import { getSydneyDateValue, getSydneyTimeValue } from "#studio/lib/bookingdatetime";

type PackageEditWarningField = keyof PackageEditDraft;

const pricingFields: readonly PackageEditWarningField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"completeEditQuantity",
	"clipsPackageQuantity",
	"handcraftedClipsQuantity",
	"packageSize"
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
	expiresDate: "Package expiry date",
	expiresTime: "Package expiry time",
	notes: "Notes",
	packageSize: "Package sessions"
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

	if (field === "expiresDate") {
		return packageRow.expiresAt === undefined
			? ""
			: getSydneyDateValue(new Date(packageRow.expiresAt));
	}

	if (field === "expiresTime") {
		return packageRow.expiresAt === undefined ? "" : getSydneyTimeValue(packageRow.expiresAt);
	}

	return packageRow[field];
}

function didPackageEditFieldChange(
	packageRow: AdminPackageRow,
	draft: PackageEditDraft,
	field: PackageEditWarningField
) {
	const currentValue = getPackageDraftValue(packageRow, field);
	const nextValue = draft[field];

	if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
		return didArrayChange(currentValue, nextValue);
	}

	return currentValue !== nextValue;
}

function getChangedFieldLabels(
	changedFields: PackageEditWarningField[],
	warningFields: readonly PackageEditWarningField[]
) {
	return changedFields.flatMap((field) =>
		warningFields.includes(field) ? [packageEditFieldLabels[field]] : []
	);
}

export function getPackageEditWarningState(packageRow: AdminPackageRow, draft: PackageEditDraft) {
	const changedFields = Object.keys(draft)
		.filter(isPackageEditWarningField)
		.filter((field) => didPackageEditFieldChange(packageRow, draft, field));

	const pricingFieldLabels = getChangedFieldLabels(changedFields, pricingFields);

	return {
		changedFieldLabels: changedFields.map((field) => packageEditFieldLabels[field]),
		pricingFieldLabels,
		requiresConfirmation: changedFields.length > 0
	};
}
