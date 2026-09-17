import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackagePaymentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const resendPackageEmail = useAction(api.packagePayment.resendPackageEmail);
	const getAdminPackageReceiptPdf = useAction(api.invoices.getAdminPackageReceiptPdfById);
	const archivePackage = useMutation(api.packages.archivePackage);
	const [isPackageEmailDialogOpen, setIsPackageEmailDialogOpen] = useState(false);

	async function handleArchiveChange(archived: boolean) {
		setPendingAction("archive");

		const [error] = await tryCatch(archivePackage({ packageId: packageRow.id, archived }));

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to archive packages.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while archiving the package.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		toast.success(archived ? "Package archived." : "Package restored.");
		setPendingAction(null);
	}

	async function handleDownloadReceipt() {
		setPendingAction("receiptDownload");

		const [error, receipt] = await tryCatch(
			getAdminPackageReceiptPdf({ packageId: packageRow.id })
		);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download receipts.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_NOT_PAID":
					toast.error("Receipts are only available after payment is confirmed.");
					break;

				case "INVALID_BOOKING_DATA":
				case "RECEIPT_PDF_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate receipt.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		downloadBlob(new Blob([receipt.content], { type: receipt.contentType }), receipt.filename);
		toast.success("Receipt download started.");
		setPendingAction(null);
	}

	async function handleResendPackageEmail() {
		setPendingAction("packageEmail");

		const [error] = await tryCatch(resendPackageEmail({ packageId: packageRow.id }));

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send package emails.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_NOT_PAID":
					toast.error("Package emails are only available after payment is confirmed.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE":
					toast.error("Only paid packages can receive a new package email.");
					break;

				case "PACKAGE_SCHEDULE_LINK_NOT_READY":
					toast.error("This package does not have an active scheduling window yet.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED":
					toast.error("Receipt and scheduling email failed to send.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the package email.");
					break;

				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		toast.success(`Package email sent to ${packageRow.customerEmail}.`);
		setIsPackageEmailDialogOpen(false);
		setPendingAction(null);
	}

	return {
		handleArchiveChange,
		handleDownloadReceipt,
		handleResendPackageEmail,
		isPackageEmailDialogOpen,
		setIsPackageEmailDialogOpen
	};
}
