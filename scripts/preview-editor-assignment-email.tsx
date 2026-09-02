import { EditorAssignmentEmail } from "#studio/features/editor-assignment-email/EditorAssignmentEmail";

const previewProps = {
	clientName: "Peter",
	deliverablesFolderName: "Deliverables (2.9.26)",
	dueDateLabel: "Monday, 7 September 2026",
	editorName: "Alex",
	rawMediaFolderName: "Raw Media (2.9.26)",
	sessionDateLabel: "Wednesday, 2 September 2026",
	signoffName: "Joseph"
};

export default function EditorAssignmentEmailPreview() {
	return <EditorAssignmentEmail {...previewProps} />;
}

EditorAssignmentEmailPreview.PreviewProps = previewProps;
