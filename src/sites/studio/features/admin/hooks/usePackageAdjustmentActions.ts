import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackageAdjustmentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const getAdjustmentInvoicePdf = useAction(
		api.packageAdjustmentInvoices.getAdminPackageAdjustmentInvoicePdf
	);
	const retryAdjustmentInvoiceEmail = useAction(
		api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail
	);
	const markAdjustmentPaymentStatus = useMutation(
		api.packageAdjustments.markPackageAdjustmentPaymentStatus
	);
	const [isAdjustmentInvoiceDialogOpen, setIsAdjustmentInvoiceDialogOpen] = useState(false);

	async function handleDownloadAdjustmentInvoice() {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentDownload");
		const [error, invoice] = await tryCatch(
			getAdjustmentInvoicePdf({ adjustmentId: packageRow.adjustment.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download adjustment invoices.");
					break;
				case "PACKAGE_ADJUSTMENT_NOT_FOUND":
					toast.error("This adjustment no longer exists.");
					break;
				case "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT":
					toast.error("The adjustment invoice has not been sent yet.");
					break;
				case "INVALID_BOOKING_DATA":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "INVOICE_DOWNLOAD_FAILED":
					toast.error("Unable to generate the adjustment invoice.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while downloading the adjustment invoice.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setPendingAction(null);
			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Adjustment invoice download started.");
		setPendingAction(null);
	}

	async function handleRetryAdjustmentInvoice() {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentEmail");
		const [error] = await tryCatch(
			retryAdjustmentInvoiceEmail({ adjustmentId: packageRow.adjustment.id })
		);

		if (error !== null) {
			switch (error.reason) {
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
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success("Adjustment invoice sent.");
		setIsAdjustmentInvoiceDialogOpen(false);
		setPendingAction(null);
	}

	async function handleAdjustmentPaymentChange(paid: boolean) {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentPayment");
		const [error] = await tryCatch(
			markAdjustmentPaymentStatus({ adjustmentId: packageRow.adjustment.id, paid })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update adjustment payments.");
					break;
				case "PACKAGE_ADJUSTMENT_NOT_FOUND":
					toast.error("This adjustment no longer exists.");
					break;
				case "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT":
					toast.error("The adjustment invoice must be sent first.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the adjustment payment.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success(paid ? "Adjustment marked paid." : "Adjustment marked unpaid.");
		setPendingAction(null);
	}

	return {
		handleAdjustmentPaymentChange,
		handleDownloadAdjustmentInvoice,
		handleRetryAdjustmentInvoice,
		isAdjustmentInvoiceDialogOpen,
		setIsAdjustmentInvoiceDialogOpen
	};
}
