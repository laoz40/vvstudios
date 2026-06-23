import { RecurringDeliverablesEmail } from "#studio/features/deliverables-email/RecurringDeliverablesEmail";

const previewProps = {
	bookingDate: "12th January",
	driveLink: "#",
	editorNotes:
		"Your edited files include the final mix, social clips, and cover artwork. Let me know if anything needs a small revision.",
	name: "Peter",
	signoffName: "Joseph"
};

export default function RecurringDeliverablesEmailPreview() {
	return <RecurringDeliverablesEmail {...previewProps} />;
}

RecurringDeliverablesEmailPreview.PreviewProps = previewProps;
