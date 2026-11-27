import { useReducer } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import { tryCatch } from "#/lib/result";
import {
	createInitialAdminEditState,
	getBillingError,
	isAdminEditConfirmationOpen,
	reduceAdminEdit,
	type AdminEditConfirmationWarnings,
	type AdminEditPhase
} from "#studio/features/admin/lib/admin-edit-machine";

export type PreparedAdminEdit<TDraft extends EditInvoiceDraft> = {
	draft: TDraft;
	warnings: AdminEditConfirmationWarnings;
	requiresConfirmation: boolean;
};

export type AdminEditConfirmationController = {
	phase: AdminEditPhase;
	isOpen: boolean;
	confirm: () => void;
	dismiss: () => void;
	retryInvoiceCheck: () => void;
};

export function useAdminEditConfirmation<TDraft extends EditInvoiceDraft>({
	target,
	saveOrdinary
}: {
	target: EditInvoiceTarget;
	saveOrdinary: (draft: TDraft) => Promise<boolean>;
}) {
	const getQuote = useAction(api.stripe.editInvoicing.getQuote);
	const sendInvoice = useAction(api.stripe.editInvoicing.saveChangesAndSendInvoice);
	const saveNonbillableDraft = useAction(api.stripe.editInvoicing.saveNonbillableDraft);

	const [state, dispatch] = useReducer(
		reduceAdminEdit<TDraft>,
		undefined,
		createInitialAdminEditState<TDraft>
	);

	async function runInvoiceCheck(draft: TDraft, warnings: AdminEditConfirmationWarnings) {
		dispatch({ type: "invoiceCheckStarted", draft, warnings });

		const [failure, quote] = await tryCatch(getQuote({ target, draft }));

		if (failure !== null) {
			dispatch({ type: "invoiceCheckFailed", error: getBillingError(failure.reason) });

			return;
		}

		dispatch({ type: "invoiceQuoteLoaded", quote });
	}

	async function submitEdit(prepared: PreparedAdminEdit<TDraft>) {
		if (state.phase.kind !== "idle") {
			return;
		}

		if (state.pendingInvoiceAttempt !== null) {
			dispatch({ type: "reopenPendingInvoiceAttempt", submittedDraft: prepared.draft });

			return;
		}

		if (!prepared.requiresConfirmation) {
			dispatch({ type: "directSaveStarted" });
			const saved = await saveOrdinary(prepared.draft);
			dispatch({ type: saved ? "saveSucceeded" : "saveFailed" });

			return;
		}

		if (prepared.warnings.pricingFieldLabels.length > 0) {
			await runInvoiceCheck(prepared.draft, prepared.warnings);

			return;
		}

		dispatch({ type: "confirmationOpened", draft: prepared.draft, warnings: prepared.warnings });
	}

	async function saveConfirmedEdit(
		phase: Extract<AdminEditPhase<TDraft>, { kind: "readyToConfirm" }>
	) {
		dispatch({ type: "confirmSaveStarted" });

		if (phase.warnings.pricingFieldLabels.length > 0) {
			const [failure, result] = await tryCatch(saveNonbillableDraft({ draft: phase.draft }));

			if (failure !== null) {
				toast.error(getBillingError(failure.reason));
				dispatch({ type: "saveFailed" });

				return;
			}

			dispatch({ type: "saveSucceeded" });

			if (result.googleOutcome === "replacementCreated") {
				toast.success("Booking updated. Replacement Calendar event created.");

				return;
			}

			toast.success(phase.draft.kind === "package" ? "Package updated." : "Booking updated.");

			return;
		}

		const saved = await saveOrdinary(phase.draft);
		dispatch({ type: saved ? "saveSucceeded" : "saveFailed" });
	}

	async function sendConfirmedInvoice(
		phase: Extract<AdminEditPhase<TDraft>, { kind: "invoiceConfirm" }>
	) {
		dispatch({ type: "invoiceSendStarted" });

		const [failure] = await tryCatch(
			sendInvoice({
				draft: phase.draft,
				requestId: phase.quote.requestId,
				revision: phase.quote.revision,
				total: phase.quote.total,
				amount: phase.quote.amount
			})
		);

		if (failure !== null) {
			const invoiceSent = "invoiceSent" in failure && Boolean(failure.invoiceSent);
			dispatch({ type: "invoiceSendFailed", reason: failure.reason, invoiceSent });

			return;
		}

		dispatch({ type: "invoiceSendSucceeded" });
		toast.success("Changes saved and Stripe invoice sent.");
	}

	async function handleConfirm() {
		if (state.phase.kind === "readyToConfirm") {
			await saveConfirmedEdit(state.phase);

			return;
		}

		if (state.phase.kind === "invoiceConfirm") {
			await sendConfirmedInvoice(state.phase);
		}
	}

	async function handleRetryInvoiceCheck() {
		if (
			state.phase.kind === "invoiceCheckFailed" ||
			(state.phase.kind === "invoiceConfirm" &&
				state.phase.error !== null &&
				!state.phase.hasConfirmed)
		) {
			await runInvoiceCheck(state.phase.draft, state.phase.warnings);
		}
	}

	function setIsEditDialogOpen(open: boolean) {
		dispatch({ type: "editDialogChanged", open });
	}

	function dismiss() {
		dispatch({ type: "confirmationDismissed" });
	}

	const confirmation: AdminEditConfirmationController = {
		phase: state.phase,
		isOpen: isAdminEditConfirmationOpen(state.phase),
		confirm: () => {
			void handleConfirm();
		},
		dismiss,
		retryInvoiceCheck: () => {
			void handleRetryInvoiceCheck();
		}
	};

	return {
		confirmation,
		isEditDialogOpen: state.isEditDialogOpen,
		isSaving: state.phase.kind !== "idle",
		setIsEditDialogOpen,
		submitEdit
	};
}
