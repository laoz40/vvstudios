import type { Doc } from "#convex/_generated/dataModel";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";

type BookingRecord = Doc<"bookings">;
export type BookingEditWarningField = keyof SessionEditDraft;

const googleEventFields: readonly BookingEditWarningField[] = [
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

const pricingFields: readonly BookingEditWarningField[] = [
	"addons",
	"duration",
	"essentialEditQuantity",
	"clipsPackageQuantity",
	"remainingBalanceAmount"
];

const bookingEditFieldLabels: Record<BookingEditWarningField, string> = {
	abn: "ABN",
	accountName: "Account name",
	addons: "Add-ons",
	clipsPackageQuantity: "Clips Package quantity",
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

function didArrayChange(currentValue: readonly string[], nextValue: readonly string[]) {
	if (currentValue.length !== nextValue.length) {
		return true;
	}

	return currentValue.some((value, index) => value !== nextValue[index]);
}

function getBookingDraftValue(booking: BookingRecord, field: BookingEditWarningField) {
	if (field === "abn" || field === "notes") {
		return booking[field] ?? "";
	}

	return booking[field] ?? undefined;
}

function didBookingEditFieldChange(
	booking: BookingRecord,
	draft: SessionEditDraft,
	field: BookingEditWarningField
) {
	const currentValue = getBookingDraftValue(booking, field);
	const nextValue = draft[field];

	if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
		return didArrayChange(currentValue, nextValue);
	}

	return (currentValue ?? undefined) !== (nextValue ?? undefined);
}

function getChangedFieldLabels(
	changedFields: BookingEditWarningField[],
	warningFields: readonly BookingEditWarningField[]
) {
	return changedFields
		.filter((field) => warningFields.includes(field))
		.map((field) => bookingEditFieldLabels[field]);
}

export function getBookingEditWarningState(booking: BookingRecord, draft: SessionEditDraft) {
	const changedFields = (Object.keys(draft) as BookingEditWarningField[]).filter((field) =>
		didBookingEditFieldChange(booking, draft, field)
	);
	const googleEventFieldLabels = getChangedFieldLabels(changedFields, googleEventFields);
	const pricingFieldLabels = getChangedFieldLabels(changedFields, pricingFields);

	const manualPriceWillBeUsed = draft.remainingBalanceAmount.trim().length > 0;

	return {
		changedFieldLabels: changedFields.map((field) => bookingEditFieldLabels[field]),
		googleEventFieldLabels,
		manualPriceWillBeUsed,
		pricingFieldLabels,
		requiresConfirmation: googleEventFieldLabels.length > 0 || pricingFieldLabels.length > 0
	};
}
