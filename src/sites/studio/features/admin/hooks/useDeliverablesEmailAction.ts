import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

const deliverablesEmailErrorMessage = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to send deliverables emails.",
	BOOKING_NOT_FOUND: "That session no longer exists.",
	SESSION_NOT_ASSIGNED_TO_EDITOR: "This session is not eligible for a deliverables email.",
	SESSION_NOT_CONFIRMED: "This session is not eligible for a deliverables email.",
	SESSION_ARCHIVED: "This session is not eligible for a deliverables email.",
	SESSION_NOT_IN_PAST: "This session is not eligible for a deliverables email.",
	INVALID_DRIVE_LINK: "Enter a valid Google Drive link.",
	DELIVERABLES_SEND_FAILED: "Unable to send deliverables email.",
	UNEXPECTED_ERROR: "Something went wrong while sending the deliverables email."
} as const;

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
	const customerTypeResult = useQuery(
		api.sessions.getDeliverablesCustomerType,
		isDeliverablesEmailDialogOpen ? { bookingId: session._id } : "skip"
	);
	// Preselect the customer type when delivery history has been checked; admins may override it.
	useEffect(() => {
		if (customerTypeResult === undefined) {
			return;
		}

		const [customerTypeError, detectedEmailVariant] = customerTypeResult;
		if (customerTypeError === null) {
			setDeliverablesEmailVariantDraft(detectedEmailVariant);
		}
	}, [customerTypeResult]);

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
			toast.error(deliverablesEmailErrorMessage[emailError.reason]);
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
		isCustomerTypeLoading: customerTypeResult === undefined,
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
