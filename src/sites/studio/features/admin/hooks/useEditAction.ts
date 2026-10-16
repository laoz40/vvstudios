import { useEditInvoice } from "#studio/features/admin/hooks/useEditInvoice";
import { useReducer } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import {
	buildSessionUpdateInput,
	parseSessionEditDraft,
	performSessionEditSave
} from "#studio/features/admin/lib/session-edit";
import { getSessionEditWarningState } from "#studio/features/admin/lib/session-edit-warnings";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	initialSessionEditState,
	reduceSessionEdit
} from "#studio/features/admin/lib/session-edit-machine";

export function useEditAction(session: SessionRecord) {
	const updateSession = useAction(api.googleCalendar.calendar.updateSessionFromAdmin);
	const [edit, dispatch] = useReducer(reduceSessionEdit, initialSessionEditState);
	const { confirmation, isEditDialogOpen, isReplacementEventDialogOpen } = edit;
	const isEditConfirmationDialogOpen = confirmation.kind === "pending" && confirmation.isOpen;
	const pendingEditWarningState = confirmation.kind === "pending" ? confirmation.warnings : null;

	const invoice = useEditInvoice({ kind: "booking", bookingId: session._id }, () => {
		dispatch({ type: "invoiceSaved" });
	});

	function setIsEditDialogOpen(open: boolean) {
		dispatch({ type: "editDialogChanged", open });
	}

	function setIsReplacementEventDialogOpen(open: boolean) {
		dispatch({ type: "replacementNoticeChanged", open });
	}

	function setIsEditConfirmationDialogOpen(open: boolean) {
		dispatch({ type: "confirmationVisibilityChanged", open });
	}

	async function saveSessionEdit(
		values: SessionEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedDraft = parseSessionEditDraft(values);

		if (parsedDraft.status !== "ok") {
			toast.error(parsedDraft.message);

			return;
		}

		const warningState = getSessionEditWarningState(session, values);

		if (!options?.skipConfirmation && warningState.requiresConfirmation) {
			dispatch({ type: "confirmationRequested", draft: values, warnings: warningState });

			if (warningState.pricingFieldLabels.length > 0) {
				dispatch({ type: "operationStarted", operation: "reviewingInvoice" });

				try {
					await invoice.reviewInvoice({
						kind: "booking",
						values: buildSessionUpdateInput(session, parsedDraft.parsedValues)
					});
				} finally {
					dispatch({ type: "operationFinished" });
				}
			}

			return;
		}

		dispatch({ type: "operationStarted", operation: "saving" });

		try {
			if (warningState.pricingFieldLabels.length > 0) {
				await invoice.saveNonbillable({
					kind: "booking",
					values: buildSessionUpdateInput(session, parsedDraft.parsedValues)
				});
			} else {
				await saveOrdinarySessionEdit(parsedDraft);
			}
		} finally {
			dispatch({ type: "operationFinished" });
		}
	}

	async function saveOrdinarySessionEdit(
		parsedDraft: Extract<ReturnType<typeof parseSessionEditDraft>, { status: "ok" }>
	) {
		const outcome = await performSessionEditSave(session, parsedDraft, updateSession);

		if (outcome === "error") return;

		dispatch({ type: "sessionSaved", replacementCreated: outcome === "replacement-created" });

		if (outcome === "replacement-created") {
			toast.success("Booking updated. Replacement Calendar event created.");

			return;
		}

		toast.success("Booking updated.");
	}

	async function handleEditBooking(values: SessionEditDraft) {
		await saveSessionEdit(values);
	}

	function closeEditConfirmationDialog() {
		dispatch({ type: "confirmationCleared" });
	}

	async function handleConfirmEditBooking() {
		if (confirmation.kind !== "pending") {
			closeEditConfirmationDialog();

			return;
		}

		const draftToSave = confirmation.draft;
		dispatch({ type: "confirmationVisibilityChanged", open: false });

		try {
			await saveSessionEdit(draftToSave, { skipConfirmation: true });
		} finally {
			dispatch({ type: "confirmationCleared" });
		}
	}

	return {
		invoice,
		closeEditConfirmationDialog,
		handleConfirmEditBooking,
		handleEditBooking,
		isEditConfirmationDialogOpen,
		isReplacementEventDialogOpen,
		isSaving: edit.operation !== "idle" || invoice.open,
		pendingEditWarningState,
		setIsEditConfirmationDialogOpen,
		isEditDialogOpen,
		setIsEditDialogOpen,
		setIsReplacementEventDialogOpen
	};
}
