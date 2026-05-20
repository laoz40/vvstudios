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
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";

export interface DeliverablesEmailProps {
	driveLink: string;
	introMessage: string;
	name: string;
	signoffName: string;
}

export function DeliverablesEmail({
	driveLink,
	introMessage,
	name,
	signoffName,
}: DeliverablesEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>Your studio deliverables folder is ready.</Preview>
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
					<Heading style={heading}>Hi {name},</Heading>
					<Text style={paragraph}>{introMessage}</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Your deliverables</Text>
						<Text style={paragraph}>
							Moving forward, all of your deliverables will be uploaded to your dedicated Google
							Drive folder below:
						</Text>
						<Section style={buttonWrapper}>
							<Button
								href={driveLink}
								style={button}>
								Open Google Drive folder
							</Button>
						</Section>
						<Text style={noteText}>
							Please note: Files are typically stored and available for 7 days after delivery, after
							which they may be archived or removed as part of our storage cycle.
						</Text>
					</Section>

					<Section style={compactSection}>
						<Text style={sectionTitle}>How to access</Text>
						<Section style={instructionCard}>
							<Text style={detailLine}>1. Open the link above.</Text>
							<Text style={detailLine}>2. Sign in with your preferred Google account.</Text>
							<Text style={lastDetailLine}>
								3. Click the icon to star the folder so you can easily find it anytime.
							</Text>
						</Section>
					</Section>

					<Text style={standaloneParagraph}>
						Any future files we deliver will be added to this same folder.
					</Text>

					<Section style={section}>
						<Text style={sectionTitle}>What to expect</Text>
						<Text style={detailLine}>
							1. A high quality video file of the full recorded session.
						</Text>
						<Text style={detailLine}>2. A polished audio file of the full recorded session.</Text>
					</Section>

					<Text style={contactParagraph}>
						If you have any questions or need revisions, contact us at{" "}
						{BOOKING_INVOICE_BUSINESS.contactEmail} or {BOOKING_INVOICE_BUSINESS.contactPhone}.
					</Text>
					<Text style={signoff}>Cheers,</Text>
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

const noteText = {
	color: "#fafafa",
	fontSize: "13px",
	fontStyle: "italic",
	lineHeight: "20px",
	margin: "12px 0 0",
};

const section = {
	margin: "0 0 28px",
};

const compactSection = {
	margin: "0 0 16px",
};

const standaloneParagraph = {
	...paragraph,
	margin: "0 0 28px",
};

const contactParagraph = {
	...paragraph,
	margin: "4px 0 12px",
};

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

const instructionCard = {
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

const lastDetailLine = {
	...detailLine,
	margin: "0",
};

const buttonWrapper = {
	margin: "28px 0",
	textAlign: "center" as const,
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
