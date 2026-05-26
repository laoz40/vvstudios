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

export interface RecurringDeliverablesEmailProps {
	bookingDate: string;
	driveLink: string;
	name: string;
	signoffName: string;
}

export function RecurringDeliverablesEmail({
	bookingDate,
	driveLink,
	name,
	signoffName,
}: RecurringDeliverablesEmailProps) {
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
						Great working with you again on the {bookingDate}. Your final deliverables are polished
						and ready to go:
					</Text>

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
					<Text style={paragraph}>
						Let me know if you need anything else, and feel free to leave any feedback once
						you&apos;ve had a look.
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
	margin: "12px 0 24px",
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
