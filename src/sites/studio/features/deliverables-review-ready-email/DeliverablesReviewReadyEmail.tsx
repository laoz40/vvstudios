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
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { EmailFooter } from "#studio/components/email/EmailFooter";
import { hostBookingQuotes } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";

export type DeliverablesReviewReadyEmailProps = {
	clientName: string;
	editorName: string;
	sessionDateLabel: string;
};

export function DeliverablesReviewReadyEmail({
	clientName,
	editorName,
	sessionDateLabel
}: DeliverablesReviewReadyEmailProps) {
	const quoteIndex = Math.floor(Math.random() * hostBookingQuotes.length);
	const selectedQuote = hostBookingQuotes[quoteIndex];

	if (selectedQuote === undefined) {
		throw new Error("Expected host booking quote");
	}

	return (
		<Html>
			<Head />
			<Preview>
				{editorName} marked {clientName}&apos;s {sessionDateLabel} session ready for review.
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
					<Heading style={heading}>Deliverables ready for review</Heading>
					<Text style={paragraph}>
						{editorName} marked <strong>{clientName}</strong>&apos;s{" "}
						<strong>{sessionDateLabel}</strong> session as ready to review.
					</Text>
					<Section style={buttonWrapper}>
						<Button
							href={`${BOOKING_INVOICE_BUSINESS.websiteUrl}${studioSite.routes.dashboard}`}
							style={button}>
							Open admin dashboard
						</Button>
					</Section>
					<Section style={quoteSection}>
						<Text style={quote}>“{selectedQuote.text}”</Text>
						<Text style={quoteAttribution}>— {selectedQuote.attribution}</Text>
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

const quoteSection = { margin: "0 0 24px" };

const quote = {
	color: "#fafafa",
	fontSize: "15px",
	fontStyle: "italic" as const,
	lineHeight: "24px",
	margin: "0 0 8px"
};

const quoteAttribution = { color: "#d0d0d0", fontSize: "13px", lineHeight: "20px", margin: "0" };
