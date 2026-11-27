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
import { withFeedbackRowKeys, type RevisionFeedbackRowInput } from "#/domain/revisions/rules";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { EmailFooter } from "#studio/components/email/EmailFooter";

export type RevisionRequestedEmailProps = {
	clientName: string;
	sessionDateLabel: string;
	sessionTimeLabel: string;
	editLabel: string;
	roundNumber: number;
	dueDateLabel: string;
	requiresClipNumber: boolean;
	feedbackRows: ReadonlyArray<RevisionFeedbackRowInput>;
	noActiveEditorAssigned: boolean;
};

export function RevisionRequestedEmail({
	clientName,
	sessionDateLabel,
	sessionTimeLabel,
	editLabel,
	roundNumber,
	dueDateLabel,
	requiresClipNumber,
	feedbackRows,
	noActiveEditorAssigned
}: RevisionRequestedEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{`Revision ${roundNumber} requested for ${editLabel} (${clientName}).`}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Img
						alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
						height="100"
						width="100"
						src={BOOKING_INVOICE_BUSINESS.logoUrl}
						style={logo}
					/>
					<Heading style={heading}>Revision {roundNumber} requested</Heading>
					{noActiveEditorAssigned ? (
						<Section style={warningCard}>
							<Text style={warningText}>
								No active editor is currently assigned to this session. Please assign an editor or
								handle this revision directly.
							</Text>
						</Section>
					) : null}
					<Section style={metaCard}>
						<Text style={metaRow}>
							<strong>Client:</strong> {clientName}
						</Text>
						<Text style={metaRow}>
							<strong>Session:</strong> {sessionDateLabel} · {sessionTimeLabel}
						</Text>
						<Text style={metaRow}>
							<strong>Edit:</strong> {editLabel}
						</Text>
						<Text style={metaRow}>
							<strong>Revision:</strong> Revision {roundNumber}
						</Text>
						<Text style={metaRowLast}>
							<strong>Due by:</strong> {dueDateLabel}
						</Text>
					</Section>
					<Section style={notesSection}>
						<Text style={sectionTitle}>Requested changes ({feedbackRows.length})</Text>
						{withFeedbackRowKeys(feedbackRows).map(({ key, row }, index) => (
							<Section
								key={key}
								style={index === feedbackRows.length - 1 ? noteRowLast : noteRow}>
								<Text style={noteTimestamp}>
									{requiresClipNumber && row.clipNumber ? `Clip ${row.clipNumber} · ` : ""}
									{row.timestamp}
								</Text>
								<Text style={noteText}>{row.note}</Text>
							</Section>
						))}
					</Section>
					<Section style={buttonWrapper}>
						<Button
							href={`${BOOKING_INVOICE_BUSINESS.websiteUrl}${studioSite.routes.dashboard}`}
							style={button}>
							Open Editor Dashboard
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

const warningCard = {
	backgroundColor: "#3d2e1e",
	border: "1px solid #8a5a2b",
	borderRadius: "10px",
	margin: "0 0 16px",
	padding: "12px 14px"
};

const warningText = { color: "#ffd7a8", fontSize: "14px", lineHeight: "20px", margin: "0" };

const metaCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0 0 20px",
	padding: "14px 16px"
};

const metaRow = { color: "#fafafa", fontSize: "14px", lineHeight: "22px", margin: "0 0 4px" };

const metaRowLast = { ...metaRow, margin: "0" };

const notesSection = { margin: "0 0 24px" };

const sectionTitle = { color: "#f5c400", fontSize: "13px", fontWeight: "600", margin: "0 0 12px" };

const noteRow = { borderBottom: "1px solid #454545", margin: "0 0 12px", padding: "0 0 12px" };

const noteRowLast = { margin: "0", padding: "0" };

const noteTimestamp = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	lineHeight: "20px",
	margin: "0 0 4px"
};

const noteText = {
	color: "#fafafa",
	fontSize: "14px",
	lineHeight: "22px",
	margin: "0",
	whiteSpace: "pre-line" as const
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
