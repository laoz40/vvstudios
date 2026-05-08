import {
	Body,
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

const bookingQuotes = [
	{
		text: "If you think you are too small to make a difference, try sleeping with a mosquito.",
		attribution: "Dalai Lama",
	},
	{
		text: "Why be moody when you can shake your booty?",
		attribution: "Marilyn Monroe",
	},
	{
		text: "People say nothing is impossible, but I do nothing every day.",
		attribution: "Winnie the Pooh",
	},
	{
		text: "The difference between try and triumph is a little umph.",
		attribution: "Marvin Phillips",
	},
	{
		text: "I’m not a businessman, I’m a business, man.",
		attribution: "Jay-Z",
	},
	{
		text: "Done is better than perfect… because perfect is usually just procrastination in disguise.",
		attribution: "Sheryl Sandberg",
	},
	{
		text: "The way to get started is to quit talking and begin doing… or at least stop overthinking your logo.",
		attribution: "Walt Disney",
	},
	{
		text: "I always wanted to be somebody, but now I realize I should have been more specific.",
		attribution: "Lily Tomlin",
	},
	{
		text: "Even if you are on the right track, you’ll get run over if you just sit there.",
		attribution: "Will Rogers",
	},
	{
		text: "Age is of no importance unless you’re a cheese.",
		attribution: "Billie Burke",
	},
	{
		text: "Never put off till tomorrow what you can do the day after tomorrow just as well.",
		attribution: "Mark Twain",
	},
	{
		text: "If you’re going through hell, keep going… stopping there would be a strange choice.",
		attribution: "Winston Churchill",
	},
] as const;

export interface HostBookingDetailsEmailProps {
	invoiceNumber: string;
	name: string;
	email: string;
	phone: string;
	accountName: string;
	abn?: string;
	date: string;
	time: string;
	service: string;
	duration: string;
	addonsLine: string;
	notes?: string;
}

export function HostBookingDetailsEmail({
	invoiceNumber,
	name,
	email,
	phone,
	accountName,
	abn,
	date,
	time,
	service,
	duration,
	addonsLine,
	notes,
}: HostBookingDetailsEmailProps) {
	const selectedQuote = bookingQuotes[Math.floor(Math.random() * bookingQuotes.length)];

	return (
		<Html>
			<Head>
				<meta
					content="address=no"
					name="format-detection"
				/>
			</Head>
			<Preview>New studio booking confirmed for {name}.</Preview>
			<Body style={body}>
				<Container style={container}>
					<Text style={invoiceNumberText}>Invoice #{invoiceNumber}</Text>
					{BOOKING_INVOICE_BUSINESS.logoUrl ? (
						<Img
							alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
							height="100"
							width="100"
							src={BOOKING_INVOICE_BUSINESS.logoUrl}
							style={logo}
						/>
					) : null}
					<Heading style={heading}>New studio booking confirmed</Heading>

					<Section style={section}>
						<Text style={sectionTitle}>Booking summary</Text>
						<Section style={summaryCard}>
							<Text style={customerName}>{name}</Text>
							<Text style={primaryDetail}>{date}</Text>
							<Text style={secondaryDetail}>{time}</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Session details</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								Recording space: <strong>{service}</strong>
							</Text>
							<Text style={detailLine}>
								Session duration: <strong>{duration}</strong>
							</Text>
							<Text style={detailLineLast}>
								Add-ons: <strong>{addonsLine}</strong>
							</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Contact details</Text>
						<Section style={detailsCard}>
							<Text style={detailLine}>
								Email: <strong>{email}</strong>
							</Text>
							<Text style={detailLine}>
								Phone: <strong>{phone}</strong>
							</Text>
							<Text style={detailLine}>
								Account name: <strong>{accountName}</strong>
							</Text>
							<Text style={detailLineLast}>
								ABN: <strong>{abn?.trim() ? abn : "Not provided"}</strong>
							</Text>
						</Section>
					</Section>

					<Section style={section}>
						<Text style={sectionTitle}>Notes</Text>
						<Section style={detailsCard}>
							<Text style={detailLineLast}>{notes?.trim() ? notes : "None"}</Text>
						</Section>
					</Section>

					<Section style={sectionLast}>
						<Text style={quote}>“{selectedQuote.text}”</Text>
						<Text style={quoteAttribution}>— {selectedQuote.attribution}</Text>
					</Section>
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

const invoiceNumberText = {
	color: "#d0d0d0",
	fontSize: "12px",
	margin: "0 0 16px",
	textAlign: "right" as const,
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

const section = {
	margin: "0 0 24px",
};

const sectionLast = {
	margin: "0",
};

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

const summaryCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	padding: "16px",
};

const customerName = {
	color: "#fafafa",
	fontSize: "18px",
	fontWeight: "400",
	lineHeight: "24px",
	margin: "0 0 12px",
};

const primaryDetail = {
	color: "#fafafa",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 4px",
};

const secondaryDetail = {
	color: "#f5c400",
	fontSize: "24px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0",
};

const detailsCard = {
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

const detailLineLast = {
	color: "#fafafa",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
};

const quote = {
	color: "#fafafa",
	fontSize: "15px",
	fontStyle: "italic",
	lineHeight: "22px",
	margin: "0 0 4px",
};

const quoteAttribution = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	lineHeight: "20px",
	margin: "0",
};
