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
	editorNotes?: string;
	name: string;
	signoffName: string;
}

export function FirstTimeDeliverablesEmail({
	bookingDate,
	driveLink,
	editorNotes,
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
					<Img
						alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
						height="100"
						width="100"
						src={BOOKING_INVOICE_BUSINESS.logoUrl}
						style={logo}
					/>
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
						<Text style={paragraph}>
							Open the link below to view your files. You do not need a Google account.
						</Text>
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
					{editorNotes ? (
						<Section style={section}>
							<Text style={sectionTitle}>Editor notes</Text>
							<Text style={editorNotesText}>{editorNotes}</Text>
						</Section>
					) : null}
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
const editorNotesText = { ...paragraph, margin: "4px 0 12px", whiteSpace: "pre-line" as const };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};

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
