import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text
} from "@react-email/components";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { DELIVERABLES_REVIEW_URL } from "#studio/features/deliverables-email/lib/constants";

export interface FirstTimeDeliverablesEmailProps {
	bookingDate: string;
	driveLink: string;
	name: string;
	signoffName: string;
}

export function FirstTimeDeliverablesEmail({
	bookingDate,
	driveLink,
	name,
	signoffName
}: FirstTimeDeliverablesEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>Your final deliverables are ready.</Preview>
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
					<Text style={paragraph}>
						Congrats on your first booking with us! It was great working with you on the{" "}
						{bookingDate}. Your final deliverables files are polished and ready to go.
					</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Your deliverables</Text>
						<Text style={paragraph}>
							Moving forward, all of your deliverables will be uploaded to your dedicated Google
							Drive folder below:
						</Text>
					</Section>

					<Section style={compactSection}>
						<Text style={subtleSectionTitle}>How to save the folder</Text>
						<Section style={instructionCard}>
							<Text style={detailLine}>1. Click “Access Your Deliverables Here” below.</Text>
							<Text style={detailLine}>2. Sign in with your preferred Google account.</Text>
							<Section style={stepGroup}>
								<Text style={groupedDetailLine}>3. Add the folder to your starred items:</Text>
								<Text style={nestedDetailLine}>
									<strong>Mobile:</strong> Tap the three dots &gt; Select “Add to Starred”
								</Text>
								<Text style={lastNestedDetailLine}>
									<strong>Desktop:</strong> Click [YOUR NAME x VV Studios] &gt; Organize &gt; Add to
									starred
								</Text>
							</Section>
							<Text style={lastDetailLine}>
								4. To find it later, open Google Drive and go to the “Starred” section.
							</Text>
						</Section>
					</Section>

					<Section style={buttonWrapper}>
						<Button
							href={driveLink}
							style={button}>
							Access Your Deliverables Here
						</Button>
					</Section>

					<Text style={noteText}>
						Please note: Files are typically stored and available for 7 days after delivery, after
						which they may be archived or removed as part of our storage cycle.
					</Text>
					<Section style={section}>
						<Text style={sectionTitle}>ENJOYED YOUR EXPERIENCE?</Text>
						<Text style={paragraph}>
							If you’re happy with how it all turned out, leaving a quick 5-star review{" "}
							<Link
								href={DELIVERABLES_REVIEW_URL}
								style={link}>
								here
							</Link>{" "}
							would help the studio a ton!
						</Text>
					</Section>
					<Section style={section}>
						<Text style={sectionTitle}>Contact</Text>
						<Text style={contactParagraph}>
							If you have any questions or need revisions, you can always reach me at{" "}
							{BOOKING_INVOICE_BUSINESS.contactEmail} or {BOOKING_INVOICE_BUSINESS.contactPhone}.
						</Text>
					</Section>
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

const noteText = {
	color: "#fafafa",
	fontSize: "13px",
	fontStyle: "italic",
	lineHeight: "20px",
	margin: "12px 0 24px"
};

const section = { margin: "0 0 20px" };

const compactSection = { margin: "0 0 16px" };

const contactParagraph = { ...paragraph, margin: "4px 0 12px" };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};

const subtleSectionTitle = {
	color: "#fafafa",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px"
};

const instructionCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	padding: "16px"
};

const detailLine = { color: "#fafafa", fontSize: "14px", lineHeight: "20px", margin: "0 0 12px" };

const stepGroup = { margin: "0 0 12px" };

const groupedDetailLine = { ...detailLine, margin: "0 0 1px" };

const nestedDetailLine = { ...detailLine, margin: "0 0 1px 16px" };

const lastNestedDetailLine = { ...detailLine, margin: "0 0 0 16px" };

const lastDetailLine = { ...detailLine, margin: "0" };

const buttonWrapper = { margin: "28px 0", textAlign: "center" as const };

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "12px",
	color: "#1a1a1a",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none"
};

const link = { color: "#f5c400", fontWeight: "600" };

const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "24px 0 4px" };

const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
