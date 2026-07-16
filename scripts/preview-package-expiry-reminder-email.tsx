import { PackageExpiryReminderEmail } from "#studio/features/package-reminder-email/PackageExpiryReminderEmail";

const previewProps = {
	expiresAtLabel: "Friday, 31 July 2026",
	name: "Alex Carter",
	remainingSessions: 3,
	signoffName: "Joseph"
};

export default function PackageExpiryReminderEmailPreview() {
	return <PackageExpiryReminderEmail {...previewProps} />;
}

PackageExpiryReminderEmailPreview.PreviewProps = previewProps;
