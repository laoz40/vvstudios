import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";

const previewProps = {
	kind: "package" as const,
	invoiceNumber: "VV-260502-PKG123",
	name: "Jordan Lee",
	email: "jordan@example.com",
	phone: "0412 987 654",
	accountName: "Jordan Lee Media",
	abn: "98 765 432 109",
	service: "Table Setup",
	duration: "2h",
	addonsLine: "Essential Edit x 4, Clips Package x 8",
	notes: "Package is for a monthly client series. Please confirm preferred recurring day.",
	packageSize: 8 as const,
	invoiceDueAtLabel: "Friday, 8 May 2026"
};

export default function PackageHostBookingDetailsEmailPreview() {
	return <HostBookingDetailsEmail {...previewProps} />;
}

PackageHostBookingDetailsEmailPreview.PreviewProps = previewProps;
