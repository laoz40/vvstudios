import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { UpdatePackageFromAdminResult } from "#convex/packages";
import type { PackageEditDraft } from "#studio/features/admin/components/PackageEditDialog";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { getPackageEditWarningState } from "#studio/features/admin/lib/package-edit-warnings";
import { multiBookingFormSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";

type ParsedPackageValues = ReturnType<typeof multiBookingFormSchema.parse>;
type PackageTotalResult = ReturnType<typeof parseRemainingBalanceAmountDraft> | null;

function buildPackageUpdateInput(
	packageRow: AdminPackageRow,
	values: PackageEditDraft,
	parsedValues: ParsedPackageValues,
	totalDueAmountResult: PackageTotalResult
) {
	return {
		multiBookingId: packageRow.id,
		name: parsedValues.name,
		phone: parsedValues.phone,
		accountName: parsedValues.accountName,
		...(parsedValues.abn ? { abn: parsedValues.abn } : {}),
		email: parsedValues.email,
		duration: parsedValues.duration,
		addons: parsedValues.addons,
		...(parsedValues.essentialEditQuantity
			? { essentialEditQuantity: parsedValues.essentialEditQuantity }
			: {}),
		...(parsedValues.clipsPackageQuantity
			? { clipsPackageQuantity: parsedValues.clipsPackageQuantity }
			: {}),
		...(parsedValues.notes ? { notes: parsedValues.notes } : {}),
		packageSize: parsedValues.packageSize,
		...(values.expiresAt !== undefined ? { expiresAt: values.expiresAt } : {}),
		...(totalDueAmountResult?.status === "valid"
			? { totalDueAmount: totalDueAmountResult.amount }
			: {})
	};
}

function showPackageUpdateError(
	error: NonNullable<UpdatePackageFromAdminResult[0]> | UnexpectedError
) {
	switch (error.reason) {
		case "NOT_AUTHENTICATED":
			toast.error("You are not signed in.");
			break;
		case "NOT_AUTHORIZED":
			toast.error("You do not have access to update packages.");
			break;
		case "PACKAGE_NOT_FOUND":
			toast.error("This package no longer exists.");
			break;
		case "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS":
			toast.error("Package sessions cannot be lower than booked sessions.");
			break;
		case "INVALID_BOOKING_DATA":
			toast.error("Please check the package details.");
			break;
		case "PACKAGE_INVALID_EXPIRY":
			toast.error("Enter a valid package expiry window.");
			break;
		case "PACKAGE_INVALID_TOTAL_DUE_AMOUNT":
			toast.error("Enter a valid total due amount.");
			break;
		case "PACKAGE_UPDATE_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while updating the package.");
			break;
		default: {
			const _exhaustive: never = error;
			void _exhaustive;
		}
	}
}

export function usePackageEditAction(packageRow: AdminPackageRow) {
	const updatePackage = useMutation(api.packages.updatePackageFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<PackageEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getPackageEditWarningState
	> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	async function saveEditPackage(
		values: PackageEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedValues = multiBookingFormSchema.safeParse({
			name: values.customerName,
			phone: values.customerPhone,
			accountName: values.accountName,
			abn: values.abn,
			email: values.customerEmail,
			duration: values.duration,
			addons: values.addons,
			essentialEditQuantity: values.essentialEditQuantity,
			clipsPackageQuantity: values.clipsPackageQuantity,
			notes: values.notes,
			packageSize: values.packageSize
		});

		if (!parsedValues.success) {
			toast.error(parsedValues.error.issues[0]?.message ?? "Please check the package details.");
			return;
		}

		const totalDueDraft = values.totalDueAmount.trim();
		const totalDueAmountResult = totalDueDraft
			? parseRemainingBalanceAmountDraft(totalDueDraft)
			: null;

		if (totalDueAmountResult?.status === "invalid") {
			toast.error("Enter a valid package total due.");
			return;
		}

		if (!options?.skipConfirmation) {
			const warningState = getPackageEditWarningState(packageRow, values);

			if (warningState.requiresConfirmation) {
				setPendingEditDraft(values);
				setPendingEditWarningState(warningState);
				setIsEditConfirmationDialogOpen(true);
				return;
			}
		}

		setIsSaving(true);

		const updateInput = buildPackageUpdateInput(
			packageRow,
			values,
			parsedValues.data,
			totalDueAmountResult
		);
		const [error] = await tryCatch<UpdatePackageFromAdminResult>(updatePackage(updateInput));

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
		closeEditConfirmationDialog,
		handleConfirmEditPackage,
		handleEditPackage,
		isEditConfirmationDialogOpen,
		isEditDialogOpen,
		isSaving,
		pendingEditWarningState,
		setIsEditConfirmationDialogOpen,
		setIsEditDialogOpen
	};
}
