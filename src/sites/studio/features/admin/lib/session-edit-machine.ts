import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import { getSessionEditWarningState } from "#studio/features/admin/lib/session-edit-warnings";

type SessionEditConfirmation =
	| { kind: "none" }
	| {
			kind: "pending";
			isOpen: boolean;
			draft: SessionEditDraft;
			warnings: ReturnType<typeof getSessionEditWarningState>;
	  };

type SessionEditOperation = "idle" | "reviewingInvoice" | "saving";

type SessionEditState = {
	isEditDialogOpen: boolean;
	isReplacementEventDialogOpen: boolean;
	operation: SessionEditOperation;
	confirmation: SessionEditConfirmation;
};

type SessionEditEvent =
	| { type: "editDialogChanged"; open: boolean }
	| { type: "replacementNoticeChanged"; open: boolean }
	| {
			type: "confirmationRequested";
			draft: SessionEditDraft;
			warnings: ReturnType<typeof getSessionEditWarningState>;
	  }
	| { type: "confirmationVisibilityChanged"; open: boolean }
	| { type: "confirmationCleared" }
	| { type: "operationStarted"; operation: "reviewingInvoice" | "saving" }
	| { type: "operationFinished" }
	| { type: "sessionSaved"; replacementCreated: boolean }
	| { type: "invoiceSaved" };

export const initialSessionEditState: SessionEditState = {
	isEditDialogOpen: false,
	isReplacementEventDialogOpen: false,
	operation: "idle",
	confirmation: { kind: "none" }
};

export function reduceSessionEdit(
	state: SessionEditState,
	event: SessionEditEvent
): SessionEditState {
	switch (event.type) {
		case "editDialogChanged":
			return { ...state, isEditDialogOpen: event.open };
		case "replacementNoticeChanged":
			return { ...state, isReplacementEventDialogOpen: event.open };
		case "confirmationRequested":
			return {
				...state,
				confirmation: {
					kind: "pending",
					isOpen: true,
					draft: event.draft,
					warnings: event.warnings
				}
			};
		case "confirmationVisibilityChanged":
			return state.confirmation.kind === "pending"
				? { ...state, confirmation: { ...state.confirmation, isOpen: event.open } }
				: state;
		case "confirmationCleared":
			return { ...state, confirmation: { kind: "none" } };
		case "operationStarted":
			return { ...state, operation: event.operation };
		case "operationFinished":
			return { ...state, operation: "idle" };
		case "sessionSaved":
			return {
				...state,
				isEditDialogOpen: false,
				isReplacementEventDialogOpen: event.replacementCreated
					? true
					: state.isReplacementEventDialogOpen
			};
		case "invoiceSaved":
			return {
				...state,
				isEditDialogOpen: false,
				confirmation:
					state.confirmation.kind === "pending"
						? { ...state.confirmation, isOpen: false }
						: state.confirmation
			};
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
