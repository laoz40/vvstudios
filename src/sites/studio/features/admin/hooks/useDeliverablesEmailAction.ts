import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

type DeliverablesEmailSendState = { status: "ready-to-send" } | { status: "status-repair" };

export function useDeliverablesEmailAction(session: SessionRecord) {
	const sendSessionDeliverablesEmail = useAction(
		api.deliverablesEmail.sendSessionDeliverablesEmail
	);
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
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

		const [emailError] = await tryCatch(
			sendSessionDeliverablesEmail({
				bookingId: session._id,
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
					toast.error("That session no longer exists.");
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
					void _exhaustive;
					break;
				}
			}

			setIsEmailingDeliverables(false);
			return;
		}

		if (!markDeliverablesAsSentAfterSending) {
			resetDeliverablesEmailDialog();
			toast.success(`Deliverables email sent to ${session.email}.`);
			setIsEmailingDeliverables(false);
			return;
		}

		await repairDeliverablesStatusAfterEmailSent(`Deliverables email sent to ${session.email}.`);
	}

	async function repairDeliverablesStatusAfterEmailSent(successMessage: string) {
		const [statusError] = await tryCatch(
			updateSessionEditStatus({ bookingId: session._id, editStatus: "completed" })
		);

		if (statusError !== null) {
			toast.error("Deliverables email sent, but status couldn't be updated. Please let us know.");
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
