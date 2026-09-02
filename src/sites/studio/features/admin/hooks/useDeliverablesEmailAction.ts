import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	formatDriveSessionMediaFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

const deliverablesEmailErrorMessage = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to send deliverables emails.",
	BOOKING_NOT_FOUND: "That session no longer exists.",
	SESSION_NOT_ASSIGNED_TO_EDITOR: "This session is not eligible for a deliverables email.",
	SESSION_NOT_CONFIRMED: "This session is not eligible for a deliverables email.",
	SESSION_ARCHIVED: "This session is not eligible for a deliverables email.",
	SESSION_NOT_IN_PAST: "This session is not eligible for a deliverables email.",
	DELIVERABLES_FOLDER_MISSING: "This session has no Deliverables folder yet.",
	DELIVERABLES_FOLDER_EMPTY: "Deliverables is empty. Add the finished files before sending.",
	DELIVERABLES_FOLDER_LIST_FAILED: "Couldn't check the Deliverables folder. Try again.",
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
	const [deliverablesEditorNotesDraft, setDeliverablesEditorNotesDraft] = useState(
		session.deliverablesClientNotes ?? ""
	);
	const [markDeliverablesAsSentAfterSending, setMarkDeliverablesAsSentAfterSending] =
		useState(true);
	const [deliverablesEmailSendState, setDeliverablesEmailSendState] =
		useState<DeliverablesEmailSendState>({ status: "ready-to-send" });
	const driveStatusResult = useQuery(
		api.sessions.getDriveStatus,
		isDeliverablesEmailDialogOpen ? { bookingId: session._id } : "skip"
	);
	const sessionStartAt = getBookingStartTimestamp(session.date, session.time);
	const deliverablesFolderName = formatDriveSessionMediaFolderName("Deliverables", sessionStartAt);
	const deliverablesFolderUrl = driveStatusResult?.[1]?.folders?.find(
		(folder) => folder.name === "Deliverables"
	)?.url;

	// Load the editor's submitted review notes whenever the send dialog opens.
	useEffect(() => {
		if (!isDeliverablesEmailDialogOpen) return;

		setDeliverablesEditorNotesDraft(session.deliverablesClientNotes ?? "");
	}, [isDeliverablesEmailDialogOpen, session.deliverablesClientNotes]);

	async function handleEmailDeliverables() {
		setIsEmailingDeliverables(true);

		if (deliverablesEmailSendState.status === "status-repair") {
			await repairDeliverablesStatusAfterEmailSent("Deliverables status updated.");
			return;
		}

		const [emailError] = await tryCatch(
			sendSessionDeliverablesEmail({
				bookingId: session._id,
				editorNotes: deliverablesEditorNotesDraft
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
		setDeliverablesEditorNotesDraft("");
		setMarkDeliverablesAsSentAfterSending(true);
		setDeliverablesEmailSendState({ status: "ready-to-send" });
		setIsDeliverablesEmailDialogOpen(false);
	}

	return {
		deliverablesEditorNotesDraft,
		deliverablesFolderName,
		deliverablesFolderUrl,
		handleEmailDeliverables,
		isDeliverablesEmailDialogOpen,
		isEmailingDeliverables,
		isFolderStatusLoading: isDeliverablesEmailDialogOpen && driveStatusResult === undefined,
		markDeliverablesAsSentAfterSending,
		setDeliverablesEditorNotesDraft,
		setIsDeliverablesEmailDialogOpen,
		setMarkDeliverablesAsSentAfterSending
	};
}
