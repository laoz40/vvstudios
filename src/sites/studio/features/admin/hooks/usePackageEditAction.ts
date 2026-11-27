import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import { useAdminEditConfirmation } from "#studio/features/admin/hooks/useAdminEditConfirmation";
import type { PackageEditDraft } from "#studio/features/admin/lib/package-edit-draft-store";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { getPackageEditWarningState } from "#studio/features/admin/lib/package-edit-warnings";
import { packageFormSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { getBookingStartTimestamp } from "#studio/lib/bookingdatetime";

type UpdatePackageFromAdminResult = FunctionReturnType<
	typeof api.packages.admin.updatePackageFromAdmin
>;

type ParsedPackageValues = ReturnType<typeof packageFormSchema.parse>;

type PackageEditInvoiceDraft = Extract<EditInvoiceDraft, { kind: "package" }>;

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
	const updatePackage = useMutation(api.packages.admin.updatePackageFromAdmin);

	const edit = useAdminEditConfirmation<PackageEditInvoiceDraft>({
		target: { kind: "package", packageId: packageRow.id },
		saveOrdinary: async (draft) => {
			const [error] = await tryCatch(updatePackage(draft.values));

			if (error !== null) {
				showPackageUpdateError(error);

				return false;
			}

			toast.success("Package updated.");

			return true;
		}
	});

	async function handleEditPackage(values: PackageEditDraft) {
		const parsedValues = parsePackageEditValues(values);

		if (!parsedValues) {
			return;
		}

		const warningState = getPackageEditWarningState(packageRow, values);

		await edit.submitEdit({
			draft: { kind: "package", values: buildPackageUpdateInput(packageRow, values, parsedValues) },
			warnings: {
				primaryFieldLabels: warningState.changedFieldLabels,
				driveIdentityFieldLabels: [],
				pricingFieldLabels: warningState.pricingFieldLabels
			},
			requiresConfirmation: warningState.requiresConfirmation
		});
	}

	return {
		confirmation: edit.confirmation,
		handleEditPackage,
		isEditDialogOpen: edit.isEditDialogOpen,
		isSaving: edit.isSaving,
		setIsEditDialogOpen: edit.setIsEditDialogOpen
	};
}
