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
import { studioSite } from "#/config/sites";
import { EmailFooter } from "#studio/components/email/EmailFooter";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";

export type SessionNotesEmailProps = {
	kind: "admin" | "editor";
	clientName: string;
	sessionDateLabel: string;
	notes: string;
};

export function SessionNotesEmail({
	kind,
	clientName,
	sessionDateLabel,
	notes
}: SessionNotesEmailProps) {
	const headingText = kind === "admin" ? "Admin notes updated" : "Editor notes updated";
	const dashboardLabel = kind === "admin" ? "Open editor dashboard" : "Open admin dashboard";
	const notesText = notes.length > 0 ? notes : "Notes were cleared.";

	return (
		<Html>
			<Head />
			<Preview>
				{headingText} for {clientName}&apos;s {sessionDateLabel} session.
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
					<Heading style={heading}>{headingText}</Heading>
					<Text style={paragraph}>
						<strong>{clientName}</strong>
						<br />
						{sessionDateLabel}
					</Text>
					<Section style={notesSection}>
						<Text style={notesStyle}>{notesText}</Text>
					</Section>
					<Section style={buttonWrapper}>
						<Button
							href={`${BOOKING_INVOICE_BUSINESS.websiteUrl}${studioSite.routes.dashboard}`}
							style={button}>
							{dashboardLabel}
						</Button>
					</Section>
					<EmailFooter />
				</Container>
			</Body>
		</Html>
	);
}

const body = {
	fontFamily: '"Gabarito Variable", Helvetica, Arial, sans-serif',
	margin: "0",
	padding: "16px"
};

const container = {
	backgroundColor: "#2d2d2d",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "24px"
};

const logo = { display: "block", margin: "0 auto 16px" };

const heading = {
	color: "#fafafa",
	fontSize: "22px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 16px"
};

const paragraph = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };

const notesSection = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "16px 0 0",
	padding: "16px"
};

const notesStyle = {
	color: "#fafafa",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0",
	overflowWrap: "break-word" as const,
	whiteSpace: "pre-wrap" as const
};

const buttonWrapper = { margin: "24px 0", textAlign: "center" as const };

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "12px",
	color: "#1a1a1a",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none"
};
