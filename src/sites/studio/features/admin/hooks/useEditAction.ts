import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import {
	parseSessionEditDraft,
	performSessionEditSave
} from "#studio/features/admin/lib/session-edit";
import { getSessionEditWarningState } from "#studio/features/admin/lib/session-edit-warnings";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function useEditAction(session: SessionRecord) {
	const updateSession = useAction(api.googleCalendar.updateSessionFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<SessionEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getSessionEditWarningState
	> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	async function saveSessionEdit(
		values: SessionEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedDraft = parseSessionEditDraft(values);

		if (parsedDraft.status !== "ok") {
			if (parsedDraft.status === "booking-invalid") {
				toast.error(parsedDraft.message);
			} else {
				toast.error("Enter a valid remaining balance.");
			}
			return;
		}

		if (!options?.skipConfirmation) {
			const warningState = getSessionEditWarningState(session, values);

			if (warningState.requiresConfirmation) {
				setPendingEditDraft(values);
				setPendingEditWarningState(warningState);
				setIsEditConfirmationDialogOpen(true);
				return;
			}
		}

		setIsSaving(true);
		const outcome = await performSessionEditSave(session, parsedDraft, updateSession);
		setIsSaving(false);

		if (outcome === "error") {
			return;
		}

		if (outcome === "replacement-created") {
			setIsEditDialogOpen(false);
			setIsReplacementEventDialogOpen(true);
			toast.success("Booking updated. Replacement Calendar event created.");
			return;
		}

		setIsEditDialogOpen(false);
		toast.success("Booking updated.");
	}

	async function handleEditBooking(values: SessionEditDraft) {
		await saveSessionEdit(values);
	}

	function closeEditConfirmationDialog() {
		setPendingEditDraft(null);
		setPendingEditWarningState(null);
		setIsEditConfirmationDialogOpen(false);
	}

	async function handleConfirmEditBooking() {
		if (!pendingEditDraft) {
			closeEditConfirmationDialog();
			return;
		}

		const draftToSave = pendingEditDraft;
		setIsEditConfirmationDialogOpen(false);
		await saveSessionEdit(draftToSave, { skipConfirmation: true });
		setPendingEditWarningState(null);
		setPendingEditDraft(null);
	}

	return {
		closeEditConfirmationDialog,
		handleConfirmEditBooking,
		handleEditBooking,
		isEditConfirmationDialogOpen,
		isEditDialogOpen,
		isReplacementEventDialogOpen,
		isSaving,
		pendingEditWarningState,
		setIsEditConfirmationDialogOpen,
		setIsEditDialogOpen,
		setIsReplacementEventDialogOpen
	};
}
