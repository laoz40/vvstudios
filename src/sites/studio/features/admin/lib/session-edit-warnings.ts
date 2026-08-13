import type { Doc } from "#convex/_generated/dataModel";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";

type SessionRecord = Doc<"bookings">;
export type SessionEditWarningField = keyof SessionEditDraft;

const googleEventFields: readonly SessionEditWarningField[] = [
	"name",
	"email",
	"service",
	"addons",
	"date",
	"time",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
	"notes"
];

const pricingFields: readonly SessionEditWarningField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
	"remainingBalanceAmount"
];

const sessionEditFieldLabels: Record<SessionEditWarningField, string> = {
	abn: "ABN",
	accountName: "Account name",
	addons: "Add-ons",
	clipsPackageQuantity: "Clip Volume Pack quantity",
	date: "Session date",
	duration: "Session duration",
	email: "Customer email",
	essentialEditQuantity: "Essential Edit quantity",
	name: "Customer name",
	notes: "Notes",
	phone: "Phone number",
	service: "Service",
	time: "Session time",
	remainingBalanceAmount: "Remaining balance due"
};

function isSessionEditWarningField(field: string): field is SessionEditWarningField {
	return Object.hasOwn(sessionEditFieldLabels, field);
}

function didArrayChange(currentValue: readonly string[], nextValue: readonly string[]) {
	if (currentValue.length !== nextValue.length) {
		return true;
	}

	return currentValue.some((value, index) => value !== nextValue[index]);
}

function getSessionDraftValue(session: SessionRecord, field: SessionEditWarningField) {
	if (
		field === "abn" ||
		field === "notes" ||
		field === "essentialEditQuantity" ||
		field === "clipsPackageQuantity"
	) {
		return session[field] ?? "";
	}

	if (field === "remainingBalanceAmount") {
		return session.remainingBalanceAmount?.toString() ?? "";
	}

	return session[field];
}

function didSessionEditFieldChange(
	session: SessionRecord,
	draft: SessionEditDraft,
	field: SessionEditWarningField
) {
	const currentValue = getSessionDraftValue(session, field);
	const nextValue = draft[field];

	if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
		return didArrayChange(currentValue, nextValue);
	}

	return currentValue !== nextValue;
}

function getChangedFieldLabels(
	changedFields: SessionEditWarningField[],
	warningFields: readonly SessionEditWarningField[]
) {
	return changedFields
		.filter((field) => warningFields.includes(field))
		.map((field) => sessionEditFieldLabels[field]);
}

export function getSessionEditWarningState(session: SessionRecord, draft: SessionEditDraft) {
	const changedFields = Object.keys(draft)
		.filter(isSessionEditWarningField)
		.filter((field) => didSessionEditFieldChange(session, draft, field));
	const googleEventFieldLabels = getChangedFieldLabels(changedFields, googleEventFields);
	const pricingFieldLabels = getChangedFieldLabels(changedFields, pricingFields);

	const manualPriceWillBeUsed = draft.remainingBalanceAmount.trim().length > 0;

	return {
		changedFieldLabels: changedFields.map((field) => sessionEditFieldLabels[field]),
		googleEventFieldLabels,
		manualPriceWillBeUsed,
		pricingFieldLabels,
		requiresConfirmation: googleEventFieldLabels.length > 0 || pricingFieldLabels.length > 0
	};
}
