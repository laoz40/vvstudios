import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Row,
	Section,
	Text
} from "@react-email/components";
import { formatAud } from "#studio/features/booking-invoice/lib/money";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";
import { formatTimeValue } from "#studio/lib/bookingdatetime";

export interface BookingInvoiceEmailProps {
	data: BookingInvoiceData;
}

export function BookingInvoiceEmail({ data }: BookingInvoiceEmailProps) {
	const receiptNote = "If transferring on the day, please email the receipt.";
	const isPackageInvoice = Boolean(data.package);
	const paymentInstruction = isPackageInvoice
		? data.notes.paymentNote
		: data.notes.paymentNote.replace(` ${receiptNote}`, "");
	const formattedSessionTime = formatTimeValue(data.booking.time);
	const signoffName = data.branding.ownerName.split(" ")[0] ?? data.branding.ownerName;
	const bookingDescription = data.booking.service
		? `Your ${data.booking.service.toLowerCase()} ${isPackageInvoice ? "package" : "session"}`
		: "Your invoice";
	const packageDescription = data.package
		? `Your ${data.package.size}-session package invoice`
		: "Your package invoice";
	const introText = isPackageInvoice
		? `${packageDescription} is attached. Once your payment clears (usually within 24 hours for first-time payments), we will automatically email you the private scheduling link.`
		: `${bookingDescription} on ${data.booking.bookingDateLabel} at ${formattedSessionTime} has been booked. Your fully itemised invoice is attached to this email.`;
	const previewText = data.package
		? `Your ${data.package.size} Pack Studio Booking Invoice from ${data.invoice.invoiceDateLabel}`
		: `Studio booking confirmed! Your booking invoice is ready with a balance due of ${formatAud(data.amounts.totalDueAmount)}.`;

	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>{previewText}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Text style={invoiceNumber}>Invoice #{data.invoice.number}</Text>
					{data.branding.logoUrl ? (
						<Img
							alt={`${data.branding.businessName} logo`}
							height="100"
							width="100"
							src={data.branding.logoUrl}
							style={logo}
						/>
					) : null}
					<Heading style={heading}>Thanks for booking, {data.customer.name}</Heading>
					<Text style={paragraph}>{introText}</Text>
					<Section style={section}>
						<Text style={sectionTitle}>Balance due</Text>
						<Section style={summaryCard}>
							<Text style={amount}>{formatAud(data.amounts.totalDueAmount)}</Text>
							<Text style={summaryDueLine}>Finalise payment by {data.invoice.dueDateLabel}</Text>
						</Section>
					</Section>
					<Section style={section}>
						<Text style={sectionTitle}>{isPackageInvoice ? "Payment terms" : "Payment"}</Text>
						<Section style={paymentNoticeCard}>
							<Text style={noticeLine}>{paymentInstruction}</Text>
							{isPackageInvoice ? null : <Text style={noteText}>*{receiptNote}</Text>}
						</Section>
						<Section style={paymentCard}>
							<Row>
								<Column style={paymentColumnLeft}>
									<Text style={paymentOptionTitle}>{data.payment.bankTransferLabel}</Text>
									<Text style={detailLine}>
										<strong>BSB:</strong> {data.payment.bsb}
									</Text>
									<Text style={detailLine}>
										<strong>Account number:</strong> {data.payment.accountNumber}
									</Text>
								</Column>
								<Column style={paymentColumnRight}>
									<Text style={paymentOptionTitle}>{data.payment.payIdLabel}</Text>
									<Text style={detailLine}>{data.payment.payId}</Text>
								</Column>
							</Row>
						</Section>
					</Section>
					{data.rescheduleUrl ? (
						<Section style={section}>
							<Text style={sectionTitle}>Need to change your time?</Text>
							<Text style={paragraph}>
								You can reschedule this booking using the private link below.
							</Text>
							<Button
								href={data.rescheduleUrl}
								style={button}>
								Reschedule booking
							</Button>
						</Section>
					) : null}
					{isPackageInvoice ? null : (
						<Section style={section}>
							<Text style={sectionTitle}>Studio location</Text>
							<Text style={paragraph}>{data.branding.locationAddress}</Text>
							<Button
								href={data.branding.locationUrl}
								style={secondaryButton}>
								View directions
							</Button>
						</Section>
					)}
					<Text style={signoff}>Enjoy your day,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{data.branding.businessName}</Text>
				</Container>
			</Body>
		</Html>
	);
}

const body = {
	fontFamily: '"Gabarito Variable", Helvetica, Arial, sans-serif',
	margin: "0",
	padding: "16px 16px"
};

const container = {
	backgroundColor: "#2d2d2d",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "24px"
};

const invoiceNumber = {
	color: "#d0d0d0",
	fontSize: "12px",
	margin: "0 0 16px",
	textAlign: "right" as const
};

const heading = {
	color: "#fafafa",
	fontSize: "22px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 16px"
};

const logo = { display: "block", margin: "0 auto 16px" };

const paragraph = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };

const summaryCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0",
	padding: "24px",
	textAlign: "center" as const
};

const detailLine = { color: "#fafafa", fontSize: "14px", lineHeight: "16px", margin: "0 0 8px" };

const paymentCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	padding: "10px 20px"
};

const paymentColumnLeft = { paddingRight: "16px", verticalAlign: "top" as const, width: "65%" };

const paymentColumnRight = {
	borderLeft: "1px solid #454545",
	paddingLeft: "16px",
	verticalAlign: "top" as const,
	width: "35%"
};

const paymentOptionTitle = {
	color: "#fafafa",
	fontSize: "14px",
	fontWeight: "700",
	margin: "0 0 12px"
};

const paymentNoticeCard = { margin: "0 0", padding: "0px 0px 18px 0px" };

const noticeLine = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" };

const noteText = {
	color: "#d0d0d0",
	fontSize: "13px",
	fontStyle: "italic",
	lineHeight: "20px",
	margin: "0"
};

const amount = {
	color: "#fafafa",
	fontSize: "36px",
	fontWeight: "700",
	margin: "10px 0 16px",
	textAlign: "center" as const
};

const summaryDueLine = {
	color: "#ff8084",
	fontSize: "14px",
	fontWeight: "600",
	margin: "0",
	textAlign: "center" as const
};

const section = { margin: "0 0 24px" };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "12px",
	color: "#1a1a1a",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none"
};

const secondaryButton = { ...button, color: "#fafafa", backgroundColor: "#212121" };

const signoff = { color: "#fafafa", fontSize: "15px", margin: "24px 0 4px" };

const signature = { color: "#fafafa", fontSize: "15px", fontWeight: "700", margin: "0" };
