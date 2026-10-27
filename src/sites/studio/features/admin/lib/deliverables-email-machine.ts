type DeliverablesEmailState = {
	isDeliverablesEmailDialogOpen: boolean;
	deliverablesEditorNotesDraft: string;
	markDeliverablesAsSentAfterSending: boolean;
	editorDueDate: string;
	kind: "ready" | "sending" | "repairingStatus" | "statusRepair";
};

type DeliverablesEmailEvent =
	| { type: "dialogOpenChanged"; open: boolean }
	| { type: "notesChanged"; notes: string }
	| { type: "markAsSentChanged"; checked: boolean }
	| { type: "dueDateChanged"; date: string }
	| { type: "sendStarted" }
	| { type: "emailFailed" }
	| { type: "statusUpdateStarted" }
	| { type: "statusUpdateFailed" }
	| { type: "completed" };

export function createDeliverablesEmailState(editorNotes: string): DeliverablesEmailState {
	return {
		isDeliverablesEmailDialogOpen: false,
		deliverablesEditorNotesDraft: editorNotes,
		markDeliverablesAsSentAfterSending: true,
		editorDueDate: "",
		kind: "ready"
	};
}

export function reduceDeliverablesEmail(
	state: DeliverablesEmailState,
	event: DeliverablesEmailEvent
): DeliverablesEmailState {
	switch (event.type) {
		case "dialogOpenChanged":
			return { ...state, isDeliverablesEmailDialogOpen: event.open };
		case "notesChanged":
			return { ...state, deliverablesEditorNotesDraft: event.notes };
		case "dueDateChanged":
			return { ...state, editorDueDate: event.date };
		case "markAsSentChanged":
			return { ...state, markDeliverablesAsSentAfterSending: event.checked };
		case "sendStarted":
			return {
				...state,
				kind:
					state.kind === "statusRepair" || state.kind === "repairingStatus"
						? "repairingStatus"
						: "sending"
			};
		case "emailFailed":
			return { ...state, kind: "ready" };
		case "statusUpdateStarted":
			return { ...state, kind: "repairingStatus" };
		case "statusUpdateFailed":
			return { ...state, kind: "statusRepair" };
		case "completed":
			return createDeliverablesEmailState("");
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
