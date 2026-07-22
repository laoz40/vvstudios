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
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";

export interface MultiBookingSchedulingEmailProps {
	addonsLine: string;
	duration: string;
	expiresAtLabel: string;
	leadTimeMinutes: number;
	name: string;
	packageSize: 4 | 8 | 12;
	scheduleUrl: string;
	signoffName: string;
}

export function MultiBookingSchedulingEmail({
	addonsLine,
	duration,
	expiresAtLabel,
	leadTimeMinutes,
	name,
	packageSize,
	scheduleUrl,
	signoffName
}: MultiBookingSchedulingEmailProps) {
	const noticeWindowLabel = formatNoticeWindowLabel(leadTimeMinutes);

	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>{`Schedule your ${packageSize} session studio package.`}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Img
						alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
						height="100"
						width="100"
						src={BOOKING_INVOICE_BUSINESS.logoUrl}
						style={logo}
					/>

					<Heading style={heading}>Good news, {name}!</Heading>
					<Text style={paragraph}>
						Your {packageSize} session studio package can be scheduled. Use your private link below
						to choose your session dates and times:
					</Text>

					<Section style={ctaSection}>
						<Button
							href={scheduleUrl}
							style={button}>
							Schedule Your Sessions Here
						</Button>
						<Text style={ctaExpiry}>Available until {expiresAtLabel}</Text>
					</Section>

					<Section style={section}>
						<Text style={note}>
							You can book sessions one at a time and return later using this link. Sessions can be
							rescheduled or cleared up to {noticeWindowLabel} before the session start.
						</Text>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Session details</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								<strong>Session duration:</strong> {duration}
							</Text>
							<Text style={detailLine}>
								<strong>Recording space:</strong> Choose a space for each session.
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
							style={secondaryButton}>
							View directions
						</Button>
					</Section>

					<Text style={signoff}>Enjoy your day,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{BOOKING_INVOICE_BUSINESS.businessName}</Text>
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

const section = { margin: "0 0 24px" };

const ctaSection = { ...section, textAlign: "center" as const, margin: "24px 0" };

const ctaExpiry = { color: "#b8b8b8", fontSize: "12px", lineHeight: "18px", margin: "8px 0 0" };

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

const note = { ...detailLine, color: "#d0d0d0", fontStyle: "italic" };

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
