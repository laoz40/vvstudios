import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

type EditorSession = FunctionReturnType<typeof api.sessions.listEditorSessions>["page"][number];
type SendState = { status: "ready-to-send" } | { status: "status-repair" };

export function useEditorDeliverablesEmailAction(session: EditorSession) {
	const sendEmail = useAction(api.deliverablesEmail.sendSessionDeliverablesEmail);
	const updateStatus = useMutation(api.sessions.updateSessionEditStatus);
	const [isOpen, setIsOpen] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [driveLink, setDriveLink] = useState("");
	const [editorNotes, setEditorNotes] = useState("");
	const [emailVariant, setEmailVariant] = useState<DeliverablesEmailVariant>("first-time");
	const [markAsSent, setMarkAsSent] = useState(true);
	const [sendState, setSendState] = useState<SendState>({ status: "ready-to-send" });

	function reset() {
		setDriveLink("");
		setEditorNotes("");
		setMarkAsSent(true);
		setSendState({ status: "ready-to-send" });
		setIsOpen(false);
	}

	async function markStatusAsSent(successMessage: string) {
		const [statusError] = await tryCatch(
			updateStatus({ bookingId: session._id, editStatus: "completed" })
		);
		if (statusError !== null) {
			toast.error("Email sent, but the deliverables status couldn't be updated.");
			setSendState({ status: "status-repair" });
			setIsSending(false);
			return;
		}

		reset();
		toast.success(successMessage);
		setIsSending(false);
	}

	async function sendDeliverablesEmail() {
		setIsSending(true);
		if (sendState.status === "status-repair") {
			await markStatusAsSent("Deliverables status updated.");
			return;
		}

		const [emailError] = await tryCatch(
			sendEmail({ bookingId: session._id, driveLink, editorNotes, emailVariant })
		);
		if (emailError !== null) {
			toast.error(
				emailError.reason === "INVALID_DRIVE_LINK"
					? "Enter a valid Google Drive link."
					: "Unable to send the deliverables email."
			);
			setIsSending(false);
			return;
		}

		if (markAsSent) {
			await markStatusAsSent("Deliverables email sent and marked as sent.");
			return;
		}

		reset();
		toast.success("Deliverables email sent. The status was left unchanged.");
		setIsSending(false);
	}

	return {
		driveLink,
		editorNotes,
		emailVariant,
		isOpen,
		isSending,
		markAsSent,
		sendDeliverablesEmail,
		setDriveLink,
		setEditorNotes,
		setEmailVariant,
		setIsOpen,
		setMarkAsSent
	};
}
