import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

function showRetryAdjustmentInvoiceError(reason: string) {
	switch (reason) {
		case "NOT_AUTHENTICATED":
			toast.error("You are not signed in.");

			return;
		case "NOT_AUTHORIZED":
			toast.error("You do not have access to retry adjustment invoices.");

			return;
		case "PACKAGE_ADJUSTMENT_NOT_FOUND":
		case "PACKAGE_NOT_FOUND":
			toast.error("This package adjustment no longer exists.");

			return;
		case "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE":
			toast.error("Only failed adjustment emails can be retried.");

			return;
		case "STRIPE_CUSTOMER_NOT_FOUND":
			toast.error("This package has no Stripe customer ID.");

			return;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while retrying the adjustment invoice.");

			return;
		default:
			toast.error("The adjustment invoice email failed again.");
	}
}

export function usePackageAdjustmentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const retryAdjustmentInvoiceEmail = useAction(
		api.packages.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail
	);

	const [isAdjustmentInvoiceDialogOpen, setIsAdjustmentInvoiceDialogOpen] = useState(false);

	async function handleRetryAdjustmentInvoice() {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentEmail");

		const [error] = await tryCatch(
			retryAdjustmentInvoiceEmail({ adjustmentId: packageRow.adjustment.id })
		);

		if (error !== null) {
			showRetryAdjustmentInvoiceError(error.reason);

			setPendingAction(null);

			return;
		}

		toast.success("Adjustment invoice sent.");
		setIsAdjustmentInvoiceDialogOpen(false);
		setPendingAction(null);
	}

	return {
		handleRetryAdjustmentInvoice,
		isAdjustmentInvoiceDialogOpen,
		setIsAdjustmentInvoiceDialogOpen
	};
}
