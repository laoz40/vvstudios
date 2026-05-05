import { HostBookingDetailsEmail } from "#/features/host-booking-details-email/HostBookingDetailsEmail";

const previewProps = {
	invoiceNumber: "VV-260502-ABC123",
	name: "Alex Carter",
	email: "alex@example.com",
	phone: "0412 345 678",
	accountName: "Alex Carter Productions",
	abn: "12 345 678 901",
	date: "Saturday, 2 May 2026",
	time: "10:00 AM",
	service: "Table Setup",
	duration: "2h",
	addonsLine: "4K UHD Recording, Clips Package",
	notes: "Please have two microphones ready and leave space for a guest camera.",
};

export default function HostBookingDetailsEmailPreview() {
	return <HostBookingDetailsEmail {...previewProps} />;
}

HostBookingDetailsEmailPreview.PreviewProps = previewProps;
