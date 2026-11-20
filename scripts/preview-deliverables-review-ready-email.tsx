import { DeliverablesReviewReadyEmail } from "#studio/features/deliverables-review-ready-email/DeliverablesReviewReadyEmail";

const previewProps = {
	quoteIndex: 0,
	clientName: "Peter",
	editorName: "Alex",
	sessionDateLabel: "Wednesday, 2 September 2026"
};

export default function DeliverablesReviewReadyEmailPreview() {
	return <DeliverablesReviewReadyEmail {...previewProps} />;
}

DeliverablesReviewReadyEmailPreview.PreviewProps = previewProps;
