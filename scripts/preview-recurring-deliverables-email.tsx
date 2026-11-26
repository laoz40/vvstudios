import { RecurringDeliverablesEmail } from "#studio/features/deliverables-email/RecurringDeliverablesEmail";

const previewProps = {
	bookingDate: "12th January",
	driveLink: "#",
	editLabel: "Clip Volume Pack",
	editorNotes:
		"Your edited files include the final mix, social clips, and cover artwork. Let me know if anything needs a small revision.",
	name: "Peter",
	revisionInfo: {
		feedbackUrl: "http://localhost:3000/revisions/sample-token",
		freeRounds: 1,
		scopeSummary: "Corrections to cuts, timing, and text errors",
		requiresClipNumber: true
	},
	signoffName: "Joseph"
};

export default function RecurringDeliverablesEmailPreview() {
	return <RecurringDeliverablesEmail {...previewProps} />;
}

RecurringDeliverablesEmailPreview.PreviewProps = previewProps;
