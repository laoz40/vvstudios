import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";

const previewProps = {
	kind: "rescheduled" as const,
	invoiceNumber: "VV-260502-ABC123",
	name: "Alex Carter",
	email: "alex@example.com",
	phone: "0412 345 678",
	accountName: "Alex Carter Productions",
	abn: "12 345 678 901",
	originalDate: "Saturday, 2 May 2026",
	originalTime: "10:00 AM – 12:00 PM",
	date: "Saturday, 9 May 2026",
	time: "2:00 PM – 4:00 PM",
	service: "Table Setup",
	duration: "2h",
	addonsLine: "4K UHD Recording, Clips Package",
	notes: "Please have two microphones ready and leave space for a guest camera."
};

export default function RescheduledHostBookingDetailsEmailPreview() {
	return <HostBookingDetailsEmail {...previewProps} />;
}

RescheduledHostBookingDetailsEmailPreview.PreviewProps = previewProps;
