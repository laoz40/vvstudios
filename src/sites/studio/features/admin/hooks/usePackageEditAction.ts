import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdatePackageFromAdminResult } from "#convex/bookings";
import type { PackageEditDraft } from "#studio/features/admin/components/PackageEditDialog";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { getPackageEditWarningState } from "#studio/features/admin/lib/package-edit-warnings";
import { multiBookingFormSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";

export function usePackageEditAction(packageRow: AdminPackageRow) {
	const updatePackage = useMutation(api.bookings.updatePackageFromAdmin);
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
			service: values.service,
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

		const [error] = await tryCatch<UpdatePackageFromAdminResult>(
			updatePackage({
				multiBookingId: packageRow.id,
				name: parsedValues.data.name,
				phone: parsedValues.data.phone,
				accountName: parsedValues.data.accountName,
				...(parsedValues.data.abn ? { abn: parsedValues.data.abn } : {}),
				email: parsedValues.data.email,
				duration: parsedValues.data.duration,
				service: parsedValues.data.service,
				addons: parsedValues.data.addons,
				...(parsedValues.data.essentialEditQuantity
					? { essentialEditQuantity: parsedValues.data.essentialEditQuantity }
					: {}),
				...(parsedValues.data.clipsPackageQuantity
					? { clipsPackageQuantity: parsedValues.data.clipsPackageQuantity }
					: {}),
				...(parsedValues.data.notes ? { notes: parsedValues.data.notes } : {}),
				packageSize: parsedValues.data.packageSize,
				...(values.expiresAt !== undefined ? { expiresAt: values.expiresAt } : {}),
				...(totalDueAmountResult?.status === "valid"
					? { totalDueAmount: totalDueAmountResult.amount }
					: {})
			})
		);

		if (error !== null) {
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
					return _exhaustive;
				}
			}

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
