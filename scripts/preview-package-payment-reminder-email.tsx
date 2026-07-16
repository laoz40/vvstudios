import { PackagePaymentReminderEmail } from "#studio/features/package-reminder-email/PackagePaymentReminderEmail";

const previewProps = {
	invoiceDueAtLabel: "Friday, 8 May 2026",
	name: "Alex Carter",
	requestDateLabel: "Friday, 1 May 2026",
	signoffName: "Joseph"
};

export default function PackagePaymentReminderEmailPreview() {
	return <PackagePaymentReminderEmail {...previewProps} />;
}

PackagePaymentReminderEmailPreview.PreviewProps = previewProps;
