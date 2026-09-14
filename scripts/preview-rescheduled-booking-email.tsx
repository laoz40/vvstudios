import { RescheduledBookingEmail } from "#studio/features/rescheduled-booking-email/RescheduledBookingEmail";

const previewProps = {
	addonsLine: "4K UHD Recording, Clip Volume Pack",
	bookingDate: "Saturday, 9 May 2026",
	bookingTime: "2:00 PM – 4:00 PM",
	duration: "2h",
	name: "Alex Carter",
	originalBookingDate: "Saturday, 2 May 2026",
	originalBookingTime: "10:00 AM – 12:00 PM",
	rescheduleUrl: "https://vvstudios.example/reschedule/sample-token",
	service: "Table Setup",
	signoffName: "Joseph"
};

export default function RescheduledBookingEmailPreview() {
	return <RescheduledBookingEmail {...previewProps} />;
}

RescheduledBookingEmailPreview.PreviewProps = previewProps;
