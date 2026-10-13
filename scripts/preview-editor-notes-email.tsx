import { SessionNotesEmail } from "#studio/features/session-notes-email/SessionNotesEmail";

const previewProps = {
	kind: "editor" as const,
	clientName: "Peter",
	sessionDateLabel: "Wednesday, 2 September 2026",
	notes: "The first cut is ready for review.\nPlease confirm the lower-third titles."
};

export default function EditorNotesEmailPreview() {
	return <SessionNotesEmail {...previewProps} />;
}

EditorNotesEmailPreview.PreviewProps = previewProps;
