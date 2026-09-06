import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export function usePackagePaymentActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const confirmPackagePayment = useAction(api.packagePayment.confirmPackagePayment);
	const retrySchedulingEmail = useAction(api.packagePayment.retryPackageSchedulingEmail);
	const archivePackage = useMutation(api.packages.archivePackage);
	const markPackageUnpaid = useMutation(api.packages.markPackageUnpaid);
	const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
	const [isSchedulingLinkDialogOpen, setIsSchedulingLinkDialogOpen] = useState(false);

	async function handleArchiveChange(archived: boolean) {
		setPendingAction("archive");

		const [error] = await tryCatch(archivePackage({ multiBookingId: packageRow.id, archived }));

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

	async function handleMarkPackageUnpaid() {
		setPendingAction("payment");

		const [error] = await tryCatch(markPackageUnpaid({ packageId: packageRow.id }));

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

		toast.success("Package marked unpaid.");
		setPendingAction(null);
	}

	async function handleConfirmPayment() {
		setPendingAction("payment");

		const [error] = await tryCatch(confirmPackagePayment({ multiBookingId: packageRow.id }));

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

		const [error] = await tryCatch(retrySchedulingEmail({ multiBookingId: packageRow.id }));

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
		handleArchiveChange,
		handleConfirmPayment,
		handleMarkPackageUnpaid,
		handleRetrySchedulingEmail,
		isPaymentDialogOpen,
		isSchedulingLinkDialogOpen,
		setIsPaymentDialogOpen,
		setIsSchedulingLinkDialogOpen
	};
}
