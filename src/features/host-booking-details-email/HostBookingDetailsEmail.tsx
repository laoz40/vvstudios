import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

export interface HostBookingDetailsEmailProps {
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

					<Section style={sectionLast}>
						<Text style={sectionTitle}>Notes</Text>
						<Section style={detailsCard}>
							<Text style={detailLineLast}>{notes?.trim() ? notes : "None"}</Text>
						</Section>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

const body = {
	backgroundColor: "#1a1a1a",
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
