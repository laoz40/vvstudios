import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
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
	const resendInvoice = useAction(api.packagePayment.resendPackageInvoiceEmail);
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminMultiBookingInvoicePdfById);
	const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);

	async function handleDownloadInvoice() {
		setPendingAction("download");

		const [error, invoice] = await tryCatch(
			getAdminPackageInvoicePdf({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
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
				case "INVOICE_DOWNLOAD_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate package invoice.");
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
		toast.success("Package invoice download started.");
		setPendingAction(null);
	}

	async function handleResendInvoice() {
		setPendingAction("invoice");

		const [error] = await tryCatch(resendInvoice({ multiBookingId: packageRow.id }));

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_NOT_UNPAID":
					toast.error("Only unpaid packages can receive invoice retries.");
					break;

				case "PACKAGE_INVOICE_EMAIL_FAILED":
				case "INVOICE_FAILURE_CODE_REQUIRED":
				case "INVOICE_NUMBER_REQUIRED":
					toast.error("Package invoice email failed again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice.");
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

		toast.success("Package invoice sent.");
		setIsInvoiceDialogOpen(false);
		setPendingAction(null);
	}

	return {
		handleDownloadInvoice,
		handleResendInvoice,
		isCustomInvoiceDialogOpen,
		isInvoiceDialogOpen,
		setIsCustomInvoiceDialogOpen,
		setIsInvoiceDialogOpen
	};
}
