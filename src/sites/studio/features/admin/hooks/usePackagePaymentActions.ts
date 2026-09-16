import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { resendReceiptWithFeedback } from "#studio/features/admin/lib/resend-receipt";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackagePaymentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const resendPackageReceipt = useAction(api.receiptEmails.resendPackageReceipt);
	const retrySchedulingEmail = useAction(api.packagePayment.retryPackageSchedulingEmail);
	const archivePackage = useMutation(api.packages.archivePackage);
	const [isSchedulingLinkDialogOpen, setIsSchedulingLinkDialogOpen] = useState(false);

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

	async function handleResendReceipt() {
		setPendingAction("receiptEmail");

		await resendReceiptWithFeedback({
			customerEmail: packageRow.customerEmail,
			entityMessages: {
				PACKAGE_NOT_FOUND: "This package no longer exists.",
				PACKAGE_NOT_PAID: "Receipts are only available after payment is confirmed."
			},
			run: () => resendPackageReceipt({ packageId: packageRow.id })
		});

		setPendingAction(null);
	}

	async function handleRetrySchedulingEmail() {
		setPendingAction("scheduleEmail");

		const [error] = await tryCatch(retrySchedulingEmail({ packageId: packageRow.id }));

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
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
				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		toast.success("Scheduling email sent.");
		setIsSchedulingLinkDialogOpen(false);
		setPendingAction(null);
	}

	return {
		handleArchiveChange,
		handleResendReceipt,
		handleRetrySchedulingEmail,
		isSchedulingLinkDialogOpen,
		setIsSchedulingLinkDialogOpen
	};
}
