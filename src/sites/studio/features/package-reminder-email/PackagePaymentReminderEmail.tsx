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

export interface PackagePaymentReminderEmailProps {
	invoiceDueAtLabel: string;
	name: string;
	requestDateLabel: string;
	signoffName: string;
}

export function PackagePaymentReminderEmail({
	invoiceDueAtLabel,
	name,
	requestDateLabel,
	signoffName
}: PackagePaymentReminderEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>Please complete your studio package payment soon.</Preview>
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
						Just a friendly reminder to complete your session package payment soon.
					</Text>

					<Section style={section}>
						<Text style={sectionTitle}>Package request</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								<strong>Request date:</strong> {requestDateLabel}
							</Text>
							<Text style={detailLine}>
								<strong>Invoice due date:</strong> {invoiceDueAtLabel}
							</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={warning}>
							If payment is not received by the due date, your booking request will be cancelled and
							the submitted form will be deleted. To book later, you will need to submit a new
							booking form.
						</Text>
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
const detailLine = { color: "#fafafa", fontSize: "14px", lineHeight: "20px", margin: "0 0 8px" };
const warning = { ...paragraph, color: "#f5c400" };
const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "24px 0 4px" };
const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
