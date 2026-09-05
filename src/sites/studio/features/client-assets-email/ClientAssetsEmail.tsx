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

export type ClientAssetsEmailProps = { assetsUrl: string; name: string; signoffName: string };

export function ClientAssetsEmail({ assetsUrl, name, signoffName }: ClientAssetsEmailProps) {
	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>
				Have assets you&apos;d like us to use in your video edit? Send them through here.
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
					<Heading style={heading}>Thanks for recording with us, {name}!</Heading>
					<Text style={paragraph}>
						If you have a logo, brand guidelines, intro, music, or any other assets you&apos;d like
						included in your video, send them through as soon as you can.
					</Text>
					<Section style={buttonWrapper}>
						<Button
							href={assetsUrl}
							style={button}>
							Upload assets for your edit
						</Button>
					</Section>
					<Section style={accountNotice}>
						<Text style={accountNoticeText}>
							When opening the folder, sign in to Google with the same email address that received
							this email.
						</Text>
					</Section>
					<Section style={sessionNotice}>
						<Text style={sectionTitle}>Uploading files for a particular session?</Text>
						<Text style={sessionNoticeText}>
							Include the session date in the file or folder name so our editors know where it
							belongs.
						</Text>
					</Section>
					<Section style={contactSection}>
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
const sessionNotice = { margin: "20px 0" };
const sessionNoticeText = { color: "#d4d4d4", fontSize: "14px", lineHeight: "22px", margin: "0" };
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
const accountNotice = {
	backgroundColor: "#3a3a3a",
	border: "1px solid #5a5a5a",
	borderRadius: "12px",
	padding: "16px"
};
const accountNoticeText = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
const contactSection = { margin: "0 0 20px" };
const contactParagraph = { ...paragraph, margin: "4px 0 12px" };
const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};
const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "0 0 4px" };
const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
