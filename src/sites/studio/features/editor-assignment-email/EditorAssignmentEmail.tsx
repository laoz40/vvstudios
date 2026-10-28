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

export type EditorAssignmentEmailProps = {
	clientName: string;
	deliverablesFolderName: string;
	dueDateLabel: string;
	editorName: string;
	rawMediaFolderName: string;
	sessionDateLabel: string;
	signoffName: string;
};

export function EditorAssignmentEmail({
	clientName,
	deliverablesFolderName,
	dueDateLabel,
	editorName,
	rawMediaFolderName,
	sessionDateLabel,
	signoffName
}: EditorAssignmentEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>
				You have been assigned to edit {clientName}&apos;s {sessionDateLabel} session.
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
					<Heading style={heading}>New editing job assigned</Heading>
					<Text style={paragraph}>Hi {editorName},</Text>
					<Text style={paragraph}>
						You have been assigned to edit {clientName}&apos;s <strong>{sessionDateLabel}</strong>{" "}
						session.
					</Text>
					<Section style={buttonWrapper}>
						<Button
							href={`${BOOKING_INVOICE_BUSINESS.websiteUrl}${studioSite.routes.dashboard}`}
							style={button}>
							Open editor dashboard
						</Button>
					</Section>
					<Section style={dueDateCard}>
						<Text style={dueDate}>
							<strong>Due date:</strong> {dueDateLabel}
						</Text>
					</Section>
					<Section style={workflow}>
						<Text style={sectionTitle}>What to do</Text>
						<Text style={step}>
							Each session in the dashboard shows its current status, with a button under it that
							moves it to the next one. Press it as you go so the team can see where the job is.
						</Text>
						<Text style={step}>
							<strong>1. Sign in.</strong> Open the editor dashboard and sign in so you can see your
							assigned sessions.
						</Text>
						<Text style={step}>
							<strong>2. Download the footage.</strong> Find your assigned session and press
							&quot;Set to Downloading&quot;. A Google Drive button appears on the right side of the
							dashboard. Click it to open the folders, then open &quot;{rawMediaFolderName}&quot;
							and download the recorded footage you need for the edit.
						</Text>
						<Text style={lastSubstep}>
							<strong>Note:</strong> Only if the Service column shows &quot;Full Edit&quot; or
							&quot;HC Clips&quot; (Handcrafted Clips) do you need to check the &quot;_Assets&quot;
							folder for brand guidelines, logos, and other supporting files.
						</Text>
						<Text style={step}>
							<strong>3. Make the edit.</strong> Once the download finishes, press &quot;Set to
							Editing&quot;. This is the fun part. Take your time and make it good.
						</Text>
						<Text style={step}>
							<strong>4. Upload the finished edit.</strong> Press &quot;Set to Uploading&quot;, then
							put every edited file the client needs in &quot;{deliverablesFolderName}&quot;.
						</Text>
						<Text style={step}>
							<strong>5. Send it for review.</strong> Press &quot;Send for review&quot; only after
							every finished file is in &quot;{deliverablesFolderName}&quot;. You can add notes for
							the client before you confirm. This emails the team, so it can&apos;t be undone.
						</Text>
						<Text style={step}>
							Pressed a button by mistake? Click &quot;Undo&quot; in the message that pops up.
						</Text>
						<Text style={lastStep}>That&apos;s it. Thanks for taking this one.</Text>
					</Section>
					<Text style={signoff}>Cheers,</Text>
					<Text style={signature}>{signoffName}</Text>
					<Text style={signature}>{BOOKING_INVOICE_BUSINESS.businessName}</Text>
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

const dueDateCard = {
	backgroundColor: "#383838",
	border: "1px solid #454545",
	borderRadius: "12px",
	margin: "0 0 20px",
	padding: "16px"
};

const dueDate = {
	color: "#ed434b",
	fontSize: "22px",
	fontWeight: "700",
	lineHeight: "30px",
	margin: "0",
	textAlign: "center" as const
};

const workflow = { margin: "0 0 24px" };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 12px",
	textTransform: "uppercase" as const
};

const step = { ...paragraph, margin: "0 0 16px" };

const lastSubstep = { ...paragraph, margin: "0 0 16px", paddingLeft: "16px" };

const lastStep = { ...paragraph, margin: "0" };

const signoff = { ...paragraph, margin: "0 0 4px" };

const signature = { ...paragraph, fontWeight: "700", margin: "0" };
