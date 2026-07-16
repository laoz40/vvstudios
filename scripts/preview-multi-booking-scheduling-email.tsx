import { MultiBookingSchedulingEmail } from "#studio/features/multi-booking-scheduling-email/MultiBookingSchedulingEmail";

const previewProps = {
	addonsLine: "4K UHD Recording, 3 x Clips Package",
	duration: "2h",
	expiresAtLabel: "Saturday, 2 May 2026",
	name: "Alex Carter",
	leadTimeMinutes: 12 * 60,
	packageSize: 8 as const,
	scheduleUrl: "https://vvstudios.example/package-schedule/sample-token",
	signoffName: "Joseph"
};

export default function MultiBookingSchedulingEmailPreview() {
	return <MultiBookingSchedulingEmail {...previewProps} />;
}

MultiBookingSchedulingEmailPreview.PreviewProps = previewProps;
