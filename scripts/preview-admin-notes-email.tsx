import { SessionNotesEmail } from "#studio/features/session-notes-email/SessionNotesEmail";

const previewProps = {
	kind: "admin" as const,
	clientName: "Peter",
	sessionDateLabel: "Wednesday, 2 September 2026",
	notes: "Please keep the opening conversation.\nUse the close-up for the final question."
};

export default function AdminNotesEmailPreview() {
	return <SessionNotesEmail {...previewProps} />;
}

AdminNotesEmailPreview.PreviewProps = previewProps;
