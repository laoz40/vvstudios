export type EditorWorkStatus = "assigned" | "editing" | "unassigned";
export type EditorAccessErrorReason =
	| "EDITOR_NOT_FOUND"
	| "NOT_AUTHENTICATED"
	| "NOT_AUTHORIZED"
	| "UNEXPECTED_ERROR";

export type ManagedEditor = {
	tokenIdentifier: string;
	displayName: string;
	email: string;
	isActive: boolean;
	lastAssignedAt: number | null;
	notes?: string;
	totalEdits: number;
	workStatus: EditorWorkStatus;
};

export const editorWorkStatusLabels = {
	assigned: "Assigned",
	editing: "Editing",
	unassigned: "Unassigned"
} as const satisfies Record<EditorWorkStatus, string>;

export const editorWorkStatusBadgeClassNames = {
	assigned: "bg-green text-primary-foreground",
	editing: "bg-primary text-primary-foreground",
	unassigned: "bg-destructive text-primary-foreground"
} as const satisfies Record<EditorWorkStatus, string>;

const assignmentDateFormatter = new Intl.DateTimeFormat("en-AU", {
	dateStyle: "medium",
	timeStyle: "short"
});

export function getEditorAccessErrorMessage(reason: EditorAccessErrorReason) {
	switch (reason) {
		case "EDITOR_NOT_FOUND":
			return "This editor no longer exists.";
		case "NOT_AUTHENTICATED":
			return "Your session has expired. Sign in again.";
		case "NOT_AUTHORIZED":
			return "You don't have permission to manage editor access.";
		case "UNEXPECTED_ERROR":
			return "Editor access could not be updated.";
		default: {
			const _exhaustive: never = reason;
			return _exhaustive;
		}
	}
}

export function formatLastAssignedAt(lastAssignedAt: number | null) {
	return lastAssignedAt === null
		? "Never"
		: assignmentDateFormatter.format(new Date(lastAssignedAt));
}
