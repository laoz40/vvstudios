import { useEffect, useReducer } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	createDeliverablesEmailState,
	reduceDeliverablesEmail
} from "#studio/features/admin/lib/deliverables-email-machine";
import {
	formatDriveSessionMediaFolderName,
	getBookingStartTimestamp,
	getEditorEditDueAt,
	getSydneyDateValue
} from "#studio/lib/bookingdatetime";

export function useDeliverablesEmailAction(session: SessionRecord) {
	const sendSessionDeliverablesEmail = useAction(
		api.editor.deliverablesEmail.sendSessionDeliverablesEmail
	);

	const restartSessionEditing = useMutation(api.sessions.admin.restartSessionEditing);
	const updateSessionEditStatus = useMutation(api.sessions.admin.updateSessionEditStatus);

	const [email, dispatch] = useReducer(
		reduceDeliverablesEmail,
		session.deliverablesClientNotes ?? "",
		createDeliverablesEmailState
	);

	const {
		isDeliverablesEmailDialogOpen,
		deliverablesEditorNotesDraft,
		markDeliverablesAsSentAfterSending,
		editorDueDate
	} = email;

	const isEmailingDeliverables = email.kind === "sending" || email.kind === "repairingStatus";

	function setIsDeliverablesEmailDialogOpen(open: boolean) {
		if (open && email.kind === "ready") {
			dispatch({
				type: "dueDateChanged",
				date: getSydneyDateValue(new Date(getEditorEditDueAt(Date.now())))
			});
		}

		dispatch({ type: "dialogOpenChanged", open });
	}

	function setDeliverablesEditorNotesDraft(notes: string) {
		dispatch({ type: "notesChanged", notes });
	}

	function setMarkDeliverablesAsSentAfterSending(checked: boolean) {
		dispatch({ type: "markAsSentChanged", checked });
	}

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

		dispatch({ type: "notesChanged", notes: session.deliverablesClientNotes ?? "" });
	}, [isDeliverablesEmailDialogOpen, session.deliverablesClientNotes]);

	async function handleEmailDeliverables() {
		if (!markDeliverablesAsSentAfterSending && !editorDueDate) return;
		dispatch({ type: "sendStarted" });

		if (email.kind === "statusRepair" || email.kind === "repairingStatus") {
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
			dispatch({ type: "emailFailed" });

			return;
		}

		await repairDeliverablesStatusAfterEmailSent(`Deliverables email sent to ${session.email}.`);
	}

	async function repairDeliverablesStatusAfterEmailSent(successMessage: string) {
		dispatch({ type: "statusUpdateStarted" });

		const [statusError] = await tryCatch(
			markDeliverablesAsSentAfterSending
				? updateSessionEditStatus({ bookingId: session._id, editStatus: "completed" })
				: restartSessionEditing({ bookingId: session._id, editorDueDate })
		);

		if (statusError !== null) {
			toast.error(
				"Client email sent, but the assignment update failed. Retry to finish without resending the client email."
			);
			dispatch({ type: "statusUpdateFailed" });

			return;
		}

		resetDeliverablesEmailDialog();
		toast.success(
			markDeliverablesAsSentAfterSending
				? successMessage
				: "Deliverables sent. Assignment reset to Not started with the new due date. Editor notification queued."
		);
	}

	function resetDeliverablesEmailDialog() {
		dispatch({ type: "completed" });
	}

	return {
		editorDueDate,
		setEditorDueDate: (date: string) => dispatch({ type: "dueDateChanged", date }),
		isStatusRepair: email.kind === "statusRepair" || email.kind === "repairingStatus",
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
