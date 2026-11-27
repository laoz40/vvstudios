import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import { useAdminEditConfirmation } from "#studio/features/admin/hooks/useAdminEditConfirmation";
import {
	buildSessionUpdateInput,
	parseSessionEditDraft,
	performSessionEditSave
} from "#studio/features/admin/lib/session-edit";
import { getSessionEditWarningState } from "#studio/features/admin/lib/session-edit-warnings";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

type BookingEditInvoiceDraft = Extract<EditInvoiceDraft, { kind: "booking" }>;

export function useEditAction(session: SessionRecord) {
	const updateSession = useAction(api.googleCalendar.calendar.updateSessionFromAdmin);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);

	const edit = useAdminEditConfirmation<BookingEditInvoiceDraft>({
		target: { kind: "booking", bookingId: session._id },
		saveOrdinary: async (draft) => {
			const outcome = await performSessionEditSave(draft.values, updateSession);

			if (outcome === "error") {
				return false;
			}

			if (outcome === "replacement-created") {
				setIsReplacementEventDialogOpen(true);
				toast.success("Booking updated. Replacement Calendar event created.");

				return true;
			}

			toast.success("Booking updated.");

			return true;
		}
	});

	async function handleEditBooking(values: SessionEditDraft) {
		const parsedDraft = parseSessionEditDraft(values);

		if (parsedDraft.status !== "ok") {
			toast.error(parsedDraft.message);

			return;
		}

		const warningState = getSessionEditWarningState(session, values);

		await edit.submitEdit({
			draft: {
				kind: "booking",
				values: buildSessionUpdateInput(session, parsedDraft.parsedValues)
			},
			warnings: {
				primaryFieldLabels: warningState.googleEventFieldLabels,
				driveIdentityFieldLabels: warningState.driveIdentityFieldLabels,
				pricingFieldLabels: warningState.pricingFieldLabels
			},
			requiresConfirmation: warningState.requiresConfirmation
		});
	}

	return {
		confirmation: edit.confirmation,
		handleEditBooking,
		isEditDialogOpen: edit.isEditDialogOpen,
		isReplacementEventDialogOpen,
		isSaving: edit.isSaving,
		setIsEditDialogOpen: edit.setIsEditDialogOpen,
		setIsReplacementEventDialogOpen
	};
}
