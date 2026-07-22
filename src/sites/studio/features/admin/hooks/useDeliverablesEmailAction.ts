import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateBookingEditStatusResult } from "#convex/bookings";
import type { SendBookingDeliverablesEmailResult } from "#convex/deliverablesEmail";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

type DeliverablesEmailSendState = { status: "ready-to-send" } | { status: "status-repair" };

type UpdateBookingEditStatusError = NonNullable<
	Awaited<ReturnType<typeof tryCatch<UpdateBookingEditStatusResult>>>[0]
>;

function showStatusUpdateError(statusError: UpdateBookingEditStatusError) {
	switch (statusError.reason) {
		case "NOT_AUTHENTICATED":
			toast.error("Deliverables email sent, but you need to sign in again to update the status.");
			break;
		case "NOT_AUTHORIZED":
			toast.error("Deliverables email sent, but you do not have access to update the status.");
			break;
		case "BOOKING_NOT_FOUND":
			toast.error("Deliverables email sent, but the booking could not be found in the database.");
			break;
		case "BOOKING_EDIT_STATUS_UPDATE_FAILED":
			toast.error("Deliverables email sent, but the status could not be updated.");
			break;
		case "UNEXPECTED_ERROR":
			toast.error("Deliverables email sent, but something went wrong updating the status.");
			break;
		default: {
			const _exhaustive: never = statusError;
			return _exhaustive;
		}
	}
}

export function useDeliverablesEmailAction(booking: BookingRecord) {
	const sendBookingDeliverablesEmail = useAction(
		api.deliverablesEmail.sendBookingDeliverablesEmail
	);
	const updateBookingEditStatus = useMutation(api.bookings.updateBookingEditStatus);
	const [isDeliverablesEmailDialogOpen, setIsDeliverablesEmailDialogOpen] = useState(false);
	const [isEmailingDeliverables, setIsEmailingDeliverables] = useState(false);
	const [deliverablesDriveLinkDraft, setDeliverablesDriveLinkDraft] = useState("");
	const [deliverablesEditorNotesDraft, setDeliverablesEditorNotesDraft] = useState("");
	const [deliverablesEmailVariantDraft, setDeliverablesEmailVariantDraft] =
		useState<DeliverablesEmailVariant>("first-time");
	const [markDeliverablesAsSentAfterSending, setMarkDeliverablesAsSentAfterSending] =
		useState(true);
	const [deliverablesEmailSendState, setDeliverablesEmailSendState] =
		useState<DeliverablesEmailSendState>({ status: "ready-to-send" });

	async function handleEmailDeliverables() {
		setIsEmailingDeliverables(true);

		if (deliverablesEmailSendState.status === "status-repair") {
			await repairDeliverablesStatusAfterEmailSent("Deliverables status updated.");
			return;
		}

		const [emailError] = await tryCatch<SendBookingDeliverablesEmailResult>(
			sendBookingDeliverablesEmail({
				bookingId: booking._id,
				driveLink: deliverablesDriveLinkDraft,
				editorNotes: deliverablesEditorNotesDraft,
				emailVariant: deliverablesEmailVariantDraft
			})
		);

		if (emailError !== null) {
			switch (emailError.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send deliverables emails.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "INVALID_DRIVE_LINK":
					toast.error("Enter a valid Google Drive link.");
					break;
				case "DELIVERABLES_SEND_FAILED":
					toast.error("Unable to send deliverables email.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the deliverables email.");
					break;
				default: {
					const _exhaustive: never = emailError;
					return _exhaustive;
				}
			}

			setIsEmailingDeliverables(false);
			return;
		}

		if (!markDeliverablesAsSentAfterSending) {
			resetDeliverablesEmailDialog();
			toast.success(`Deliverables email sent to ${booking.email}.`);
			setIsEmailingDeliverables(false);
			return;
		}

		await repairDeliverablesStatusAfterEmailSent(`Deliverables email sent to ${booking.email}.`);
	}

	async function repairDeliverablesStatusAfterEmailSent(successMessage: string) {
		const [statusError] = await tryCatch<UpdateBookingEditStatusResult>(
			updateBookingEditStatus({ bookingId: booking._id, editStatus: "completed" })
		);

		if (statusError !== null) {
			showStatusUpdateError(statusError);
			setDeliverablesEmailSendState({ status: "status-repair" });
			setIsEmailingDeliverables(false);
			return;
		}

		resetDeliverablesEmailDialog();
		toast.success(successMessage);
		setIsEmailingDeliverables(false);
	}

	function resetDeliverablesEmailDialog() {
		setDeliverablesDriveLinkDraft("");
		setDeliverablesEditorNotesDraft("");
		setMarkDeliverablesAsSentAfterSending(true);
		setDeliverablesEmailSendState({ status: "ready-to-send" });
		setIsDeliverablesEmailDialogOpen(false);
	}

	return {
		deliverablesDriveLinkDraft,
		deliverablesEditorNotesDraft,
		deliverablesEmailVariantDraft,
		handleEmailDeliverables,
		isDeliverablesEmailDialogOpen,
		isEmailingDeliverables,
		markDeliverablesAsSentAfterSending,
		setDeliverablesDriveLinkDraft,
		setDeliverablesEditorNotesDraft,
		setDeliverablesEmailVariantDraft,
		setIsDeliverablesEmailDialogOpen,
		setMarkDeliverablesAsSentAfterSending
	};
}
