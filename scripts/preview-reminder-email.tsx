import { ReminderEmail } from "#/features/reminder-email/ReminderEmail";

const previewProps = {
	addonsLine: "4K UHD Recording, Clips Package",
	bookingDate: "Saturday, 2 May 2026",
	bookingTime: "10:00 AM",
	duration: "2h",
	name: "Alex Carter",
	service: "Table Setup",
	signoffName: "Joseph",
};

export default function ReminderEmailPreview() {
	return <ReminderEmail {...previewProps} />;
}

ReminderEmailPreview.PreviewProps = previewProps;
