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
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { EmailFooter } from "#studio/components/email/EmailFooter";

export interface RescheduledBookingEmailProps {
	addonsLine: string;
	bookingDate: string;
	bookingTime: string;
	duration: string;
	name: string;
	originalBookingDate: string;
	originalBookingTime: string;
	rescheduleUrl?: string;
	service: string;
	signoffName: string;
}

export function RescheduledBookingEmail({
	addonsLine,
	bookingDate,
	bookingTime,
	duration,
	name,
	originalBookingDate,
	originalBookingTime,
	rescheduleUrl,
	service,
	signoffName
}: RescheduledBookingEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>
				Your studio booking has moved to {bookingDate} at {bookingTime}.
			</Preview>
			<Body style={body}>
				<Container style={container}>
					<Img
						alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
						height="100"
						width="100"
						src={BOOKING_INVOICE_BUSINESS.logoUrl}
						style={logo}
					/>
					<Heading style={heading}>Hello {name},</Heading>
					<Text style={paragraph}>Your studio booking has been rescheduled.</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Booking summary</Text>
						<Section style={summaryCard}>
							<Text style={customerName}>{name}</Text>
							<Text style={originalTiming}>
								Originally: <strong>{originalBookingDate}</strong>, {originalBookingTime}
							</Text>
							<Text style={newTimingLabel}>Changed to</Text>
							<Text style={primaryDetail}>{bookingDate}</Text>
							<Text style={secondaryDetail}>{bookingTime}</Text>
						</Section>
						<Text style={arrivalReminder}>
							Please arrive <strong>15 minutes early</strong> to maximise your recording time.
						</Text>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Session details</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								Recording space: <strong>{service}</strong>
							</Text>
							<Text style={detailLine}>
								Session duration: <strong>{duration}</strong>
							</Text>
							<Text style={detailLineLast}>
								Add-ons: <strong>{addonsLine}</strong>
							</Text>
						</Section>
					</Section>

					{rescheduleUrl ? (
						<Section style={section}>
							<Text style={sectionTitle}>Need to change your time again?</Text>
							<Text style={paragraph}>
								You can reschedule this booking using the private link below.
							</Text>
							<Button
								href={rescheduleUrl}
								style={button}>
								Reschedule booking
							</Button>
						</Section>
					) : null}

					<Section style={section}>
						<Text style={sectionTitle}>Studio location</Text>
						<Text style={paragraph}>{BOOKING_INVOICE_BUSINESS.locationAddress}</Text>
						<Button
							href={BOOKING_INVOICE_BUSINESS.locationUrl}
							style={secondaryButton}>
							View directions
						</Button>
					</Section>
					<Text style={signoff}>See you soon,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{BOOKING_INVOICE_BUSINESS.businessName}</Text>
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
	padding: "16px"
};

const customerName = {
	color: "#fafafa",
	fontSize: "18px",
	fontWeight: "400",
	lineHeight: "24px",
	margin: "0 0 12px"
};

const originalTiming = {
	color: "#d0d0d0",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0 0 12px"
};

const newTimingLabel = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 4px",
	textTransform: "uppercase" as const
};

const primaryDetail = {
	color: "#fafafa",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 4px"
};

const secondaryDetail = {
	color: "#f5c400",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0"
};

const arrivalReminder = {
	color: "#fafafa",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "8px 0 0"
};

const section = { margin: "0 0 24px" };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};

const detailsCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	padding: "16px"
};

const detailLine = { color: "#fafafa", fontSize: "14px", lineHeight: "20px", margin: "0 0 8px" };

const detailLineLast = { color: "#fafafa", fontSize: "14px", lineHeight: "20px", margin: "0" };

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

const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "24px 0 4px" };

const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
