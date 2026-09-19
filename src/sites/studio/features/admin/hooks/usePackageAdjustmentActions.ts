import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackageAdjustmentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const retryAdjustmentInvoiceEmail = useAction(
		api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail
	);

	const [isAdjustmentInvoiceDialogOpen, setIsAdjustmentInvoiceDialogOpen] = useState(false);

	async function handleRetryAdjustmentInvoice() {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentEmail");

		const [error] = await tryCatch(
			retryAdjustmentInvoiceEmail({ adjustmentId: packageRow.adjustment.id })
		);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to retry adjustment invoices.");
					break;
				case "PACKAGE_ADJUSTMENT_NOT_FOUND":
				case "PACKAGE_NOT_FOUND":
					toast.error("This package adjustment no longer exists.");
					break;
				case "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE":
					toast.error("Only failed adjustment emails can be retried.");
					break;
				case "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED":
					toast.error("The adjustment invoice email failed again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while retrying the adjustment invoice.");
					break;
				default:
					exhaustiveCheck(reason);
			}

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
