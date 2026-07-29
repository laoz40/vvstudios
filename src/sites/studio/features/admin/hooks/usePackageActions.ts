import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type { ArchivePackageResult, MarkPackagePaymentStatusResult } from "#convex/packages";
import type { GetAdminMultiBookingInvoicePdfByIdResult } from "#convex/invoices";
import type {
	GetAdminPackageAdjustmentInvoicePdfResult,
	RetryPackageAdjustmentInvoiceEmailResult
} from "#convex/packageAdjustmentInvoices";
import type { MarkPackageAdjustmentPaymentStatusResult } from "#convex/packageAdjustments";
import type {
	ConfirmPackagePaymentResult,
	ResendPackageInvoiceEmailResult,
	RetryPackageSchedulingEmailResult
} from "#convex/packagePayment";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { usePackageEditAction } from "#studio/features/admin/hooks/usePackageEditAction";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

export function usePackageActions(packageRow: AdminPackageRow) {
	const resendInvoice = useAction(api.packagePayment.resendPackageInvoiceEmail);
	const confirmPackagePayment = useAction(api.packagePayment.confirmPackagePayment);
	const retrySchedulingEmail = useAction(api.packagePayment.retryPackageSchedulingEmail);
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminMultiBookingInvoicePdfById);
	const getAdjustmentInvoicePdf = useAction(
		api.packageAdjustmentInvoices.getAdminPackageAdjustmentInvoicePdf
	);
	const retryAdjustmentInvoiceEmail = useAction(
		api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail
	);
	const archivePackage = useMutation(api.packages.archivePackage);
	const markPaymentStatus = useMutation(api.packages.markPackagePaymentStatus);
	const markAdjustmentPaymentStatus = useMutation(
		api.packageAdjustments.markPackageAdjustmentPaymentStatus
	);
	const editAction = usePackageEditAction(packageRow);

	const [pendingAction, setPendingAction] = useState<AdminPackagePendingAction>(null);
	const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
	const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
	const [isAdjustmentInvoiceDialogOpen, setIsAdjustmentInvoiceDialogOpen] = useState(false);
	const [isSchedulingLinkDialogOpen, setIsSchedulingLinkDialogOpen] = useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);

	const isActionPending = pendingAction !== null;

	async function handleDownloadInvoice() {
		setPendingAction("download");

		const [error, invoice] = await tryCatch<GetAdminMultiBookingInvoicePdfByIdResult>(
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
	async function handleDownloadAdjustmentInvoice() {
		if (!packageRow.adjustment) return;

		setPendingAction("adjustmentDownload");
		const [error, invoice] = await tryCatch<GetAdminPackageAdjustmentInvoicePdfResult>(
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
		const [error] = await tryCatch<RetryPackageAdjustmentInvoiceEmailResult>(
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
		const [error] = await tryCatch<MarkPackageAdjustmentPaymentStatusResult>(
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

	async function handleResendInvoice() {
		setPendingAction("invoice");

		const [error] = await tryCatch<ResendPackageInvoiceEmailResult>(
			resendInvoice({ multiBookingId: packageRow.id })
		);

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

	async function handleArchiveChange(archived: boolean) {
		setPendingAction("archive");

		const [error] = await tryCatch<ArchivePackageResult>(
			archivePackage({ multiBookingId: packageRow.id, archived })
		);

		if (error !== null) {
			switch (error.reason) {
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

				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success(archived ? "Package archived." : "Package restored.");
		setPendingAction(null);
	}

	async function handlePaymentChange(paid: boolean) {
		setPendingAction("payment");

		const [error] = await tryCatch<MarkPackagePaymentStatusResult>(
			markPaymentStatus({ multiBookingId: packageRow.id, paid })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update package payment.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_PAYMENT_CONFIRMATION_REQUIRED":
					toast.error("Confirm package payments from the payment dialog.");
					break;

				case "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED":
					toast.error("Unable to update package payment.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating package payment.");
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

		toast.success(paid ? "Package marked paid." : "Package marked unpaid.");
		setPendingAction(null);
	}

	async function handleConfirmPayment() {
		setPendingAction("payment");

		const [error] = await tryCatch<ConfirmPackagePaymentResult>(
			confirmPackagePayment({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to confirm package payments.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_ALREADY_PAID":
					toast.error("This package is already marked paid.");
					break;

				case "PACKAGE_NOT_UNPAID":
					toast.error("Only unpaid packages can be confirmed as paid.");
					break;

				case "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED":
					toast.error("Unable to mark this package paid.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED":
					toast.error("Package was marked paid, but the scheduling email failed.");
					setIsPaymentDialogOpen(false);
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED":
					toast.error(
						"Package was marked paid, but the scheduling email failed and we could not save that failure status."
					);
					setIsPaymentDialogOpen(false);
					break;

				case "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email sent, but the package status did not update.");
					setIsPaymentDialogOpen(false);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while confirming payment.");
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

		toast.success("Package marked paid and scheduling email sent.");
		setIsPaymentDialogOpen(false);
		setPendingAction(null);
	}

	async function handleRetrySchedulingEmail() {
		setPendingAction("scheduleEmail");

		const [error] = await tryCatch<RetryPackageSchedulingEmailResult>(
			retrySchedulingEmail({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send scheduling links.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE":
					toast.error("Only paid packages can receive a new scheduling link.");
					break;

				case "PACKAGE_SCHEDULE_LINK_NOT_READY":
					toast.error("This package does not have an active scheduling window yet.");
					break;

				case "PACKAGE_SCHEDULE_TOKEN_UPDATE_FAILED":
					toast.error("Unable to refresh the scheduling link.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED":
					toast.error("Scheduling email failed again.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email failed again, and we could not save that failure status.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email sent, but the package status did not update.");
					setIsSchedulingLinkDialogOpen(false);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the scheduling link.");
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

		toast.success("Scheduling email sent.");
		setIsSchedulingLinkDialogOpen(false);
		setPendingAction(null);
	}

	return {
		editAction,
		handleAdjustmentPaymentChange,
		handleArchiveChange,
		handleConfirmPayment,
		handleDownloadAdjustmentInvoice,
		handleDownloadInvoice,
		handlePaymentChange,
		handleResendInvoice,
		handleRetryAdjustmentInvoice,
		handleRetrySchedulingEmail,
		isActionPending,
		isAdjustmentInvoiceDialogOpen,
		isCustomInvoiceDialogOpen,
		isInvoiceDialogOpen,
		isPaymentDialogOpen,
		isSchedulingLinkDialogOpen,
		pendingAction,
		setIsAdjustmentInvoiceDialogOpen,
		setIsCustomInvoiceDialogOpen,
		setIsInvoiceDialogOpen,
		setIsPaymentDialogOpen,
		setIsSchedulingLinkDialogOpen
	};
}
