import { RecurringDeliverablesEmail } from "#studio/features/deliverables-email/RecurringDeliverablesEmail";

const previewProps = {
	bookingDate: "12th January",
	driveLink: "#",
	name: "Peter",
	signoffName: "Joseph",
};

export default function RecurringDeliverablesEmailPreview() {
	return <RecurringDeliverablesEmail {...previewProps} />;
}

RecurringDeliverablesEmailPreview.PreviewProps = previewProps;
