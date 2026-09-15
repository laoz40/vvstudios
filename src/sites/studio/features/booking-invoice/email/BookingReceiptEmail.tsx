import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Text
} from "@react-email/components";
import { exhaustiveCheck } from "#/lib/result";
import type { BookingReceiptData } from "#studio/features/booking-invoice/lib/types";
import { EmailFooter } from "#studio/components/email/EmailFooter";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface BookingReceiptEmailProps {
	data: BookingReceiptData;
}

function getReceiptPreviewText(data: BookingReceiptData) {
	switch (data.kind) {
		case "adjustment":
			return `Remote Podcast adjustment payment received for your ${data.adjustment.packageSize}-session package. Your receipt is attached.`;
		case "package":
			return `${data.package.size}-session package confirmed. Your receipt is attached.`;
		case "booking":
			return `Studio booking confirmed for ${data.booking.bookingDateLabel}. Your receipt is attached.`;
		default:
			return exhaustiveCheck(data);
	}
}

function getReceiptHeading(data: BookingReceiptData) {
	switch (data.kind) {
		case "adjustment":
			return `Thanks for your payment, ${data.customer.name}`;
		case "package":
			return `Thanks for your purchase, ${data.customer.name}`;
		case "booking":
			return `Thanks for booking, ${data.customer.name}`;
		default:
			return exhaustiveCheck(data);
	}
}

function getReceiptIntro(data: BookingReceiptData) {
	switch (data.kind) {
		case "adjustment":
			return "Your Remote Podcast adjustment payment is confirmed. Your receipt is attached to this email.";
		case "package":
			return "Your package payment is confirmed. Your receipt is attached to this email.";
		case "booking":
			return "Your studio session is confirmed. Your receipt is attached to this email.";
		default:
			return exhaustiveCheck(data);
	}
}

function getReceiptSummaryTitle(data: BookingReceiptData) {
	switch (data.kind) {
		case "adjustment":
			return "Adjustment summary";
		case "package":
			return "Package summary";
		case "booking":
			return "Booking summary";
		default:
			return exhaustiveCheck(data);
	}
}

function ReceiptSummary({ data }: { data: BookingReceiptData }) {
	switch (data.kind) {
		case "adjustment":
			return (
				<>
					<Text style={summaryLine}>
						<strong>Package:</strong> {data.adjustment.packageSize} sessions
					</Text>
					<Text style={summaryLine}>
						<strong>Booked:</strong> {data.adjustment.bookedAtLabel}
					</Text>
					<Text style={summaryLine}>
						<strong>Adjustment:</strong> {data.booking.addonsSummary}
					</Text>
				</>
			);
		case "package":
			return (
				<>
					<Text style={summaryLine}>
						<strong>Package:</strong> {data.package.size} sessions
					</Text>
					<Text style={summaryLine}>
						<strong>Duration:</strong> {data.booking.duration}
					</Text>
					<Text style={summaryLine}>
						<strong>Add-ons:</strong> {data.booking.addonsSummary}
					</Text>
				</>
			);
		case "booking": {
			const sessionTimeRange = formatBookingTimeRange(data.booking.time, data.booking.duration);

			return (
				<>
					<Text style={summaryLine}>
						<strong>Date:</strong> {data.booking.bookingDateLabel}
					</Text>
					<Text style={summaryLine}>
						<strong>Time:</strong> {sessionTimeRange}
					</Text>
					{data.booking.service ? (
						<Text style={summaryLine}>
							<strong>Service:</strong> {data.booking.service}
						</Text>
					) : null}
					<Text style={summaryLine}>
						<strong>Add-ons:</strong> {data.booking.addonsSummary}
					</Text>
				</>
			);
		}

		default:
			return exhaustiveCheck(data);
	}
}

export function BookingReceiptEmail({ data }: BookingReceiptEmailProps) {
	const signoffName = data.branding.ownerName.split(" ")[0] ?? data.branding.ownerName;
	const previewText = getReceiptPreviewText(data);

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
					<Text style={receiptNumber}>Receipt #{data.receipt.number}</Text>
					{data.branding.logoUrl ? (
						<Img
							alt={`${data.branding.businessName} logo`}
							height="100"
							width="100"
							src={data.branding.logoUrl}
							style={logo}
						/>
					) : null}
					<Heading style={heading}>{getReceiptHeading(data)}</Heading>
					<Text style={paragraph}>{getReceiptIntro(data)}</Text>
					<Section style={section}>
						<Text style={sectionTitle}>{getReceiptSummaryTitle(data)}</Text>
						<Section style={summaryCard}>
							<ReceiptSummary data={data} />
						</Section>
					</Section>
					{data.kind === "booking" && data.rescheduleUrl ? (
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
					<Section style={section}>
						<Text style={sectionTitle}>Studio location</Text>
						<Text style={paragraph}>{data.branding.locationAddress}</Text>
						<Button
							href={data.branding.locationUrl}
							style={secondaryButton}>
							View directions
						</Button>
					</Section>
					<Text style={signoff}>Enjoy your day,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{data.branding.businessName}</Text>
					<EmailFooter />
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

const receiptNumber = {
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
	padding: "24px"
};

const summaryLine = { color: "#fafafa", fontSize: "14px", lineHeight: "22px", margin: "0 0 8px" };

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
