import { EditorAssignmentEmail } from "#studio/features/editor-assignment-email/EditorAssignmentEmail";

const previewProps = {
	deliverablesFolderName: "Deliverables (2.9.26)",
	editorName: "Alex",
	rawMediaFolderName: "Raw Media (2.9.26)",
	sessionLabel: "Peter, 2 September 2026",
	signoffName: "Joseph"
};

export default function EditorAssignmentEmailPreview() {
	return <EditorAssignmentEmail {...previewProps} />;
}

EditorAssignmentEmailPreview.PreviewProps = previewProps;
