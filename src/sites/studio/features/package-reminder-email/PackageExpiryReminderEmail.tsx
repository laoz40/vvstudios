import {
	Body,
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

export interface PackageExpiryReminderEmailProps {
	expiresAtLabel: string;
	name: string;
	remainingSessions: number;
	signoffName: string;
}

export function PackageExpiryReminderEmail({
	expiresAtLabel,
	name,
	remainingSessions,
	signoffName
}: PackageExpiryReminderEmailProps) {
	const sessionLabel = remainingSessions === 1 ? "session" : "sessions";

	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>Schedule your remaining package sessions before expiry.</Preview>
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
						Just a friendly reminder to schedule your {remainingSessions} remaining {sessionLabel}{" "}
						before your package expires.
					</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Package expiry</Text>
						<Section style={detailsCard}>
							<Text style={remainingSessionsDetail}>
								<strong>Remaining sessions:</strong> {remainingSessions}
							</Text>
							<Text style={expiryDate}>
								<strong>Expiry date: {expiresAtLabel}</strong>
							</Text>
						</Section>
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
const remainingSessionsDetail = {
	color: "#fafafa",
	fontSize: "22px",
	fontWeight: "700",
	lineHeight: "30px",
	margin: "0 0 8px",
	textAlign: "center" as const
};
const expiryDate = {
	color: "#ed434b",
	fontSize: "22px",
	lineHeight: "30px",
	margin: "0",
	textAlign: "center" as const
};
const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "24px 0 4px" };
const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
