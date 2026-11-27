import { RevisionRequestedEmail } from "#studio/features/revision-requested-email/RevisionRequestedEmail";

const previewProps = {
	clientName: "Peter",
	dueDateLabel: "Tue, 14 Apr, 11:59 pm AEST",
	editLabel: "Rough Cut (Video 2)",
	feedbackRows: [
		{ note: "Trim the pause before the intro starts.", timestamp: "00:12-00:18" },
		{ note: "Fix spelling of the guest's surname on the lower third.", timestamp: "04:35" }
	],
	noActiveEditorAssigned: false,
	requiresClipNumber: false,
	sessionDateLabel: "Wednesday, 8 April 2026",
	sessionTimeLabel: "10:00am - 11:00am"
};

export default function RevisionRequestedEmailPreview() {
	return <RevisionRequestedEmail {...previewProps} />;
}

RevisionRequestedEmailPreview.PreviewProps = previewProps;
