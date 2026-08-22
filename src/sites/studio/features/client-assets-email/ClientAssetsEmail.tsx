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
						If you have any assets you&apos;d like us to use in your video, please upload them as
						soon as you can.
					</Text>
					<Text style={paragraph}>This could be your logo, brand guidelines, intro, or music.</Text>
					<Text style={paragraph}>
						Uploading assets is optional. If you don&apos;t have anything to add, there&apos;s
						nothing you need to do.
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
const signoff = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "24px 0 4px" };
const signature = {
	color: "#fafafa",
	fontSize: "15px",
	fontWeight: "700",
	lineHeight: "24px",
	margin: "0"
};
