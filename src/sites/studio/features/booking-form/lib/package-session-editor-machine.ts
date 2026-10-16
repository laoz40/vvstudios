import { isAddonAvailableForService, type BookingService } from "#/domain/booking/catalog";

export interface PackageSessionDraft {
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: BookingService | "";
	selectedTime: string;
}

type PackageSessionEditorState = PackageSessionDraft &
	({ kind: "closed"; activeSessionKey: null } | { kind: "editing"; activeSessionKey: string });

type PackageSessionEditorEvent =
	| { type: "sessionChosen"; sessionKey: string; draft: PackageSessionDraft }
	| { type: "editorClosed" }
	| { type: "draftCleared" }
	| { type: "dateChanged"; dateValue: string }
	| { type: "timeChanged"; time: string }
	| { type: "serviceChanged"; service: BookingService }
	| { type: "remotePodcastChanged"; checked: boolean }
	| { type: "notesChanged"; notes: string };

const emptyDraft: PackageSessionDraft = {
	selectedDateValue: "",
	selectedNotes: "",
	selectedRemotePodcast: false,
	selectedService: "",
	selectedTime: ""
};

export const initialPackageSessionEditorState: PackageSessionEditorState = {
	kind: "closed",
	activeSessionKey: null,
	...emptyDraft
};

// Closing hides the editor without clearing its values.
// Choosing a session replaces those values with that session's booking details.
export function reducePackageSessionEditor(
	state: PackageSessionEditorState,
	event: PackageSessionEditorEvent
): PackageSessionEditorState {
	switch (event.type) {
		case "sessionChosen":
			return {
				...event.draft,
				kind: "editing",
				activeSessionKey: event.sessionKey,
				selectedRemotePodcast:
					isAddonAvailableForService(event.draft.selectedService, "Remote Podcast") &&
					event.draft.selectedRemotePodcast
			};
		case "editorClosed":
			return { ...state, kind: "closed", activeSessionKey: null };
		case "draftCleared":
			return { ...state, ...emptyDraft };
		case "dateChanged":
			return { ...state, selectedDateValue: event.dateValue, selectedTime: "" };
		case "timeChanged":
			return { ...state, selectedTime: event.time };
		case "serviceChanged":
			return {
				...state,
				selectedService: event.service,
				selectedRemotePodcast: isAddonAvailableForService(event.service, "Remote Podcast")
					? state.selectedRemotePodcast
					: false
			};
		case "remotePodcastChanged":
			return { ...state, selectedRemotePodcast: event.checked };
		case "notesChanged":
			return { ...state, selectedNotes: event.notes };
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
