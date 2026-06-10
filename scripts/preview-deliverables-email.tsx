import { FirstTimeDeliverablesEmail } from "#studio/features/deliverables-email/FirstTimeDeliverablesEmail";

const previewProps = {
	bookingDate: "12th January",
	driveLink: "#",
	name: "Peter",
	signoffName: "Joseph"
};

export default function FirstTimeDeliverablesEmailPreview() {
	return <FirstTimeDeliverablesEmail {...previewProps} />;
}

FirstTimeDeliverablesEmailPreview.PreviewProps = previewProps;
