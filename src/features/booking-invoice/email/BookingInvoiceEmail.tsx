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
	Text,
} from "@react-email/components";
import { formatAud } from "#/features/booking-invoice/lib/money";
import type { BookingInvoiceData } from "#/features/booking-invoice/lib/types";
import { formatTimeValue } from "#/lib/bookingdatetime";

export interface BookingInvoiceEmailProps {
	data: BookingInvoiceData;
}

export function BookingInvoiceEmail({ data }: BookingInvoiceEmailProps) {
	const receiptNote = "If transferring on the day, please email the receipt.";
	const paymentInstruction = data.notes.paymentNote.replace(` ${receiptNote}`, "");
	const formattedSessionTime = formatTimeValue(data.booking.time);

	return (
		<Html>
			<Head />
			<Preview>
				Studio booking confirmed! Your invoice is ready with a balance due of{" "}
				{formatAud(data.amounts.totalDueAmount)}.
			</Preview>
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
					<Text style={paragraph}>
						Your {data.booking.service.toLowerCase()} session on{" "}
						<strong>{data.booking.bookingDateLabel}</strong> at{" "}
						<strong>{formattedSessionTime}</strong> has been booked. Your fully itemised invoice is
						attached to this email.
					</Text>
					<Section style={summaryCard}>
						<Text style={eyebrow}>Balance due</Text>
						<Text style={amount}>{formatAud(data.amounts.totalDueAmount)}</Text>
						<Text style={summaryDueLine}>Due: {data.invoice.dueDateLabel}</Text>
					</Section>
					<Section style={section}>
						<Text style={sectionTitle}>Payment methods</Text>
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
						<Section style={paymentNoticeCard}>
							<Text style={noticeLine}>
								<strong>Payment:</strong> {paymentInstruction}
							</Text>
							<Text style={noteText}>*{receiptNote}</Text>
						</Section>
					</Section>
					<Section style={section}>
						<Text style={sectionTitle}>Studio location</Text>
						<Button
							href={data.branding.locationUrl}
							style={button}>
							View directions
						</Button>
					</Section>
					<Text style={signoff}>Enjoy your day,</Text>
					<Text style={signature}>{data.branding.businessName}</Text>
				</Container>
			</Body>
		</Html>
	);
}

const body = {
	backgroundColor: "#f6f7f9",
	fontFamily: "Helvetica, Arial, sans-serif",
	margin: "0",
	padding: "16px 16px",
};

const container = {
	backgroundColor: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "16px",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "16px",
};

const invoiceNumber = {
	color: "#6b7280",
	fontSize: "12px",
	margin: "0 0 16px",
	textAlign: "right" as const,
};

const heading = {
	color: "#111827",
	fontSize: "16px",
	fontWeight: "600",
	margin: "0 0 16px",
};

const logo = {
	display: "block",
	margin: "0 auto 16px",
};

const paragraph = {
	color: "#374151",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 12px",
};

const summaryCard = {
	backgroundColor: "#f9fafb",
	border: "1px solid #e5e7eb",
	borderRadius: "12px",
	margin: "24px 0",
	padding: "24px",
	textAlign: "center" as const,
};

const detailLine = {
	color: "#374151",
	fontSize: "14px",
	lineHeight: "16px",
	margin: "0 0 8px",
};

const paymentCard = {
	border: "1px solid #e5e7eb",
	borderRadius: "12px",
	padding: "10px 20px",
};

const paymentColumnLeft = {
	paddingRight: "16px",
	verticalAlign: "top" as const,
	width: "65%",
};

const paymentColumnRight = {
	borderLeft: "1px solid #e5e7eb",
	paddingLeft: "16px",
	verticalAlign: "top" as const,
	width: "35%",
};

const paymentOptionTitle = {
	color: "#111827",
	fontSize: "14px",
	fontWeight: "700",
	margin: "0 0 12px",
};

const paymentNoticeCard = {
	margin: "0 0",
	padding: "18px 0px",
};

const noticeLine = {
	color: "#374151",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 8px",
};

const noteText = {
	color: "#6b7280",
	fontSize: "13px",
	fontStyle: "italic",
	lineHeight: "20px",
	margin: "0",
};

const eyebrow = {
	color: "#6b7280",
	fontSize: "12px",
	letterSpacing: "0.08em",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

const amount = {
	color: "#111827",
	fontSize: "36px",
	fontWeight: "700",
	margin: "0 0 16px",
};

const summaryDueLine = {
	color: "#d90429",
	fontSize: "14px",
	fontWeight: "600",
	margin: "0",
};

const section = {
	margin: "0 0 24px",
};

const sectionTitle = {
	color: "#6d7481",
	fontSize: "14px",
	fontWeight: "700",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "8px",
	color: "#000",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none",
};

const signoff = {
	color: "#374151",
	fontSize: "15px",
	margin: "24px 0 4px",
};

const signature = {
	color: "#111827",
	fontSize: "15px",
	fontWeight: "700",
	margin: "0",
};
