import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackageInvoiceActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminPackageInvoicePdfById);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);

	async function handleDownloadInvoice() {
		setPendingAction("download");

		const [error, invoice] = await tryCatch(
			getAdminPackageInvoicePdf({ packageId: packageRow.id })
		);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "INVALID_BOOKING_DATA":
				case "INVOICE_PDF_RENDER_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate package invoice.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Package invoice download started.");
		setPendingAction(null);
	}

	return { handleDownloadInvoice, isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen };
}
