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
import type { BookingReceiptData } from "#studio/features/booking-invoice/lib/types";
import { EmailFooter } from "#studio/components/email/EmailFooter";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface BookingReceiptEmailProps {
	data: BookingReceiptData;
}

export function BookingReceiptEmail({ data }: BookingReceiptEmailProps) {
	const isPackageReceipt = data.package !== undefined;
	const signoffName = data.branding.ownerName.split(" ")[0] ?? data.branding.ownerName;
	const sessionTimeRange = formatBookingTimeRange(data.booking.time, data.booking.duration);
	const previewText = isPackageReceipt
		? `${data.package?.size}-session package confirmed. Your receipt is attached.`
		: `Studio booking confirmed for ${data.booking.bookingDateLabel}. Your receipt is attached.`;

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
					<Heading style={heading}>
						{isPackageReceipt
							? `Thanks for your purchase, ${data.customer.name}`
							: `Thanks for booking, ${data.customer.name}`}
					</Heading>
					<Text style={paragraph}>
						{isPackageReceipt
							? "Your package payment is confirmed. Your receipt is attached to this email."
							: "Your studio session is confirmed. Your receipt is attached to this email."}
					</Text>
					<Section style={section}>
						<Text style={sectionTitle}>
							{isPackageReceipt ? "Package summary" : "Booking summary"}
						</Text>
						<Section style={summaryCard}>
							{isPackageReceipt ? (
								<>
									<Text style={summaryLine}>
										<strong>Package:</strong> {data.package?.size} sessions
									</Text>
									<Text style={summaryLine}>
										<strong>Duration:</strong> {data.booking.duration}
									</Text>
									<Text style={summaryLine}>
										<strong>Add-ons:</strong> {data.booking.addonsSummary}
									</Text>
								</>
							) : (
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
							)}
						</Section>
					</Section>
					{!isPackageReceipt && data.rescheduleUrl ? (
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
