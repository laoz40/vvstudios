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
	Text,
} from "@react-email/components";
import { BOOKING_INVOICE_BUSINESS } from "#/features/booking-invoice/lib/constants";

export interface ReminderEmailProps {
	addonsLine: string;
	bookingDate: string;
	bookingTime: string;
	duration: string;
	name: string;
	service: string;
	signoffName: string;
}

export function ReminderEmail({
	addonsLine,
	bookingDate,
	bookingTime,
	duration,
	name,
	service,
	signoffName,
}: ReminderEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>Your studio session is scheduled for tomorrow at {bookingTime}.</Preview>
			<Body style={body}>
				<Container style={container}>
					{BOOKING_INVOICE_BUSINESS.logoUrl ? (
						<Img
							alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
							height="100"
							width="100"
							src={BOOKING_INVOICE_BUSINESS.logoUrl}
							style={logo}
						/>
					) : null}
					<Heading style={heading}>Hello {name},</Heading>
					<Text style={paragraph}>
						This is a reminder that your studio session is scheduled for tomorrow.
					</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Session date</Text>
						<Section style={summaryCard}>
							<Text style={primaryDetail}>{bookingDate}</Text>
							<Text style={secondaryDetail}>{bookingTime}</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Session details</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								<strong>Recording space:</strong> {service}
							</Text>
							<Text style={detailLine}>
								<strong>Session duration:</strong> {duration}
							</Text>
							<Text style={detailLine}>
								<strong>Add-ons:</strong> {addonsLine}
							</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Studio location</Text>
						<Text style={paragraph}>{BOOKING_INVOICE_BUSINESS.locationAddress}</Text>
						<Button
							href={BOOKING_INVOICE_BUSINESS.locationUrl}
							style={button}>
							View directions
						</Button>
					</Section>

					<Text style={paragraph}>
						Payment is due at the end of your session. We look forward to seeing you.
					</Text>
					<Text style={signoff}>Enjoy your day,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{BOOKING_INVOICE_BUSINESS.locationLabel}</Text>
				</Container>
			</Body>
		</Html>
	);
}

const body = {
	backgroundColor: "#1a1a1a",
	fontFamily: '"Gabarito Variable", Helvetica, Arial, sans-serif',
	margin: "0",
	padding: "16px 16px",
};

const container = {
	backgroundColor: "#2d2d2d",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "24px",
};

const heading = {
	color: "#fafafa",
	fontSize: "22px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 16px",
};

const logo = {
	display: "block",
	margin: "0 auto 16px",
};

const paragraph = {
	color: "#fafafa",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 12px",
};

const summaryCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0",
	padding: "16px",
};

const primaryDetail = {
	color: "#fafafa",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 4px",
};

const secondaryDetail = {
	color: "#f5c400",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0",
};

const section = {
	margin: "0 0 24px",
};

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

const detailsCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	padding: "16px",
};

const detailLine = {
	color: "#fafafa",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0 0 8px",
};

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "12px",
	color: "#1a1a1a",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none",
};

const signoff = {
	color: "#fafafa",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "24px 0 4px",
};

const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0",
};
