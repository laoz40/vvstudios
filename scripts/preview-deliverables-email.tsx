import { FirstTimeDeliverablesEmail } from "#studio/features/deliverables-email/FirstTimeDeliverablesEmail";

const previewProps = {
	bookingDate: "12th January",
	driveLink: "#",
	editLabel: "Complete Edit",
	editorNotes:
		"Your edited files include the final mix, social clips, and cover artwork. Let me know if anything needs a small revision.",
	name: "Peter",
	revisionInfo: {
		feedbackUrl: "http://localhost:3000/revisions/sample-token",
		freeRounds: 2,
		requiresClipNumber: false
	},
	signoffName: "Joseph"
};

export default function FirstTimeDeliverablesEmailPreview() {
	return <FirstTimeDeliverablesEmail {...previewProps} />;
}

FirstTimeDeliverablesEmailPreview.PreviewProps = previewProps;
