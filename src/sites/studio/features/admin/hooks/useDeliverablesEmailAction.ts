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

function deliverablesEmailErrorToast(reason: string) {
	const driveError = getDeliverablesDriveErrorToast(reason);

	if (driveError !== undefined) return driveError;

	switch (reason) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "NOT_AUTHORIZED":
			return "You do not have access to send deliverables emails.";
		case "BOOKING_NOT_FOUND":
			return "That session no longer exists.";
		case "SESSION_NOT_ASSIGNED_TO_EDITOR":
		case "SESSION_NOT_CONFIRMED":
		case "SESSION_NOT_IN_PAST":
			return "This session is not eligible for a deliverables email.";
		case "DELIVERABLES_FOLDER_EMPTY":
			return "Deliverables is empty. Add the finished files before sending.";
		case "EMAIL_RENDER_FAILED":
		case "EMAIL_REQUEST_FAILED":
		case "EMAIL_RESPONSE_FAILED":
			return "Unable to send deliverables email.";
		default:
			return "Something went wrong while sending the deliverables email.";
	}
}

function getDeliverablesDriveErrorToast(reason: string): string | undefined {
	switch (reason) {
		case "GOOGLE_DRIVE_AUTH_FAILED":
			return "Couldn't access Google Drive. Try again.";
		case "GOOGLE_DRIVE_FOLDER_MISSING":
			return "This session has no Deliverables folder yet.";
		case "GOOGLE_DRIVE_FOLDER_CREATE_FAILED":
		case "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID":
		case "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED":
		case "GOOGLE_DRIVE_FOLDER_RENAME_FAILED":
		case "GOOGLE_DRIVE_FOLDER_DELETE_FAILED":
			return "Couldn't access the Deliverables folder. Try again.";
		case "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_DELETE_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID":
		case "GOOGLE_DRIVE_SHARE_TARGET_MISSING":
			return "Couldn't create a viewable Deliverables link. Try again.";
		default:
			return undefined;
	}
}

type DeliverablesEmailSendState = { status: "ready-to-send" } | { status: "status-repair" };

export function useDeliverablesEmailAction(session: SessionRecord) {
	const sendSessionDeliverablesEmail = useAction(
		api.editor.deliverablesEmail.sendSessionDeliverablesEmail
	);

	const updateSessionEditStatus = useMutation(api.sessions.admin.updateSessionEditStatus);
	const [isDeliverablesEmailDialogOpen, setIsDeliverablesEmailDialogOpen] = useState(false);
	const [isEmailingDeliverables, setIsEmailingDeliverables] = useState(false);

	const [deliverablesEditorNotesDraft, setDeliverablesEditorNotesDraft] = useState(
		session.deliverablesClientNotes ?? ""
	);

	const [markDeliverablesAsSentAfterSending, setMarkDeliverablesAsSentAfterSending] =
		useState(false);

	const [deliverablesEmailSendState, setDeliverablesEmailSendState] =
		useState<DeliverablesEmailSendState>({ status: "ready-to-send" });

	const driveStatusResult = useQuery(
		api.sessions.admin.getDriveStatus,
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
			toast.error(deliverablesEmailErrorToast(emailError.reason));
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
		setMarkDeliverablesAsSentAfterSending(false);
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
