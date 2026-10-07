import { useEditInvoice } from "#studio/features/admin/hooks/useEditInvoice";
import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { PackageEditDraft } from "#studio/features/admin/lib/package-edit-draft-store";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { getPackageEditWarningState } from "#studio/features/admin/lib/package-edit-warnings";
import {
	packageFormSchema,
	pickBookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import { getBookingStartTimestamp } from "#studio/lib/bookingdatetime";

type UpdatePackageFromAdminResult = FunctionReturnType<typeof api.packages.updatePackageFromAdmin>;

type ParsedPackageValues = ReturnType<typeof packageFormSchema.parse>;

type PackageUpdateInput = {
	packageId: AdminPackageRow["id"];
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: ParsedPackageValues["addons"];
	essentialEditQuantity?: string;
	completeEditQuantity?: string;
	clipsPackageQuantity?: string;
	handcraftedClipsQuantity?: string;
	notes?: string;
	packageSize: ParsedPackageValues["packageSize"];
	expiresAt?: number;
};

function buildPackageUpdateInput(
	packageRow: AdminPackageRow,
	values: PackageEditDraft,
	parsedValues: ParsedPackageValues
) {
	const input: PackageUpdateInput = {
		packageId: packageRow.id,
		name: parsedValues.name,
		phone: parsedValues.phone,
		accountName: parsedValues.accountName,
		email: parsedValues.email,
		duration: parsedValues.duration,
		addons: parsedValues.addons,
		...pickBookingAddonQuantities(parsedValues),
		packageSize: parsedValues.packageSize
	};

	if (parsedValues.abn) {
		input.abn = parsedValues.abn;
	}

	if (parsedValues.notes) {
		input.notes = parsedValues.notes;
	}

	if (values.expiresDate && values.expiresTime) {
		const expiresAt = getBookingStartTimestamp(values.expiresDate, values.expiresTime);

		if (expiresAt > 0) {
			input.expiresAt = expiresAt;
		}
	}

	return input;
}

function parsePackageEditValues(values: PackageEditDraft) {
	const parsedValues = packageFormSchema.safeParse({
		name: values.customerName,
		phone: values.customerPhone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.customerEmail,
		duration: values.duration,
		addons: values.addons,
		...pickBookingAddonQuantities(values),
		notes: values.notes,
		packageSize: values.packageSize
	});

	if (!parsedValues.success) {
		toast.error(parsedValues.error.issues[0]?.message ?? "Please check the package details.");

		return null;
	}

	return parsedValues.data;
}

type PackageUpdateError = NonNullable<UpdatePackageFromAdminResult[0]> | UnexpectedError;

const packageUpdateErrors = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to update packages.",
	PACKAGE_NOT_FOUND: "This package no longer exists.",
	PACKAGE_SIZE_BELOW_BOOKED_SESSIONS: "Package sessions cannot be lower than booked sessions.",
	INVALID_BOOKING_DATA: "Please check the package details.",
	PACKAGE_INVALID_EXPIRY: "Enter a valid package expiry window.",
	UNEXPECTED_ERROR: "Something went wrong while updating the package."
} satisfies Record<PackageUpdateError["reason"], string>;

function showPackageUpdateError(error: PackageUpdateError) {
	toast.error(packageUpdateErrors[error.reason]);
}

export function usePackageEditAction(packageRow: AdminPackageRow) {
	const updatePackage = useMutation(api.packages.updatePackageFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

	const invoice = useEditInvoice({ kind: "package", packageId: packageRow.id }, () => {
		setIsEditDialogOpen(false);
		setIsEditConfirmationDialogOpen(false);
	});

	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<PackageEditDraft | null>(null);

	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getPackageEditWarningState
	> | null>(null);

	const [isSaving, setIsSaving] = useState(false);

	async function reviewPackageChanges(
		values: PackageEditDraft,
		parsedValues: ParsedPackageValues,
		warningState: ReturnType<typeof getPackageEditWarningState>
	) {
		setPendingEditDraft(values);
		setPendingEditWarningState(warningState);
		setIsEditConfirmationDialogOpen(true);

		if (warningState.pricingFieldLabels.length > 0) {
			setIsSaving(true);
			await invoice.reviewInvoice({
				kind: "package",
				values: buildPackageUpdateInput(packageRow, values, parsedValues)
			});
			setIsSaving(false);
		}
	}

	async function saveEditPackage(
		values: PackageEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedValues = parsePackageEditValues(values);

		if (!parsedValues) {
			return;
		}

		if (!options?.skipConfirmation) {
			const warningState = getPackageEditWarningState(packageRow, values);

			if (warningState.requiresConfirmation) {
				await reviewPackageChanges(values, parsedValues, warningState);

				return;
			}
		}

		setIsSaving(true);

		const updateInput = buildPackageUpdateInput(packageRow, values, parsedValues);

		if (getPackageEditWarningState(packageRow, values).pricingFieldLabels.length > 0) {
			const draft = { kind: "package" as const, values: updateInput };

			await invoice.saveNonbillable(draft);
			setIsSaving(false);

			return;
		}

		const [error] = await tryCatch(updatePackage(updateInput));

		if (error !== null) {
			showPackageUpdateError(error);
			setIsSaving(false);

			return;
		}

		setIsEditDialogOpen(false);
		toast.success("Package updated.");

		setIsSaving(false);
	}

	async function handleEditPackage(values: PackageEditDraft) {
		await saveEditPackage(values);
	}

	function closeEditConfirmationDialog() {
		setPendingEditDraft(null);
		setPendingEditWarningState(null);
		setIsEditConfirmationDialogOpen(false);
	}

	async function handleConfirmEditPackage() {
		if (!pendingEditDraft) {
			closeEditConfirmationDialog();

			return;
		}

		const draftToSave = pendingEditDraft;
		setIsEditConfirmationDialogOpen(false);
		await saveEditPackage(draftToSave, { skipConfirmation: true });
		setPendingEditWarningState(null);
		setPendingEditDraft(null);
	}

	return {
		invoice,
		isEditDialogOpen,
		closeEditConfirmationDialog,
		handleConfirmEditPackage,
		handleEditPackage,
		isEditConfirmationDialogOpen,
		isSaving: isSaving || invoice.open,
		pendingEditWarningState,
		setIsEditConfirmationDialogOpen,
		setIsEditDialogOpen
	};
}
