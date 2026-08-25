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

export type EditorAssignmentEmailProps = {
	deliverablesFolderName: string;
	editorName: string;
	rawMediaFolderName: string;
	sessionLabel: string;
	signoffName: string;
};

export function EditorAssignmentEmail({
	deliverablesFolderName,
	editorName,
	rawMediaFolderName,
	sessionLabel,
	signoffName
}: EditorAssignmentEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>You have been assigned {sessionLabel}.</Preview>
			<Body style={body}>
				<Container style={container}>
					<Img
						alt={`${BOOKING_INVOICE_BUSINESS.businessName} logo`}
						height="100"
						width="100"
						src={BOOKING_INVOICE_BUSINESS.logoUrl}
						style={logo}
					/>
					<Heading style={heading}>New edit assigned</Heading>
					<Text style={paragraph}>Hi {editorName},</Text>
					<Text style={paragraph}>You have been assigned {sessionLabel}.</Text>
					<Section style={buttonWrapper}>
						<Button
							href="/admin"
							style={button}>
							Open editor dashboard
						</Button>
					</Section>
					<Text style={menuNotice}>
						For each session, press the three-dot button on the right of the dashboard row to open
						the editing and Google Drive actions.
					</Text>
					<Section style={workflow}>
						<Text style={step}>
							<strong>1. Start the edit.</strong> Find the assigned session, open the three-dot
							menu, and click &quot;Start editing&quot; before working on the files. This lets the
							team know editing has begun.
						</Text>
						<Text style={stepHeading}>
							<strong>2. Get the files.</strong>
						</Text>
						<Text style={substep}>
							<strong>Raw media.</strong> Find the assigned session, open the three-dot menu, and
							click &quot;Google Drive folders&quot;. Then open &quot;{rawMediaFolderName}
							&quot; and download the recorded footage you need for the edit.
						</Text>
						<Text style={lastSubstep}>
							<strong>Assets.</strong> Check the client&apos;s separate &quot;_Assets&quot; folder
							for any relevant brand guidelines, logos, and other supporting files.
						</Text>
						<Text style={step}>
							<strong>3. Upload the finished edit.</strong> Put every edited file the client needs
							in &quot;{deliverablesFolderName}&quot;.
						</Text>
						<Text style={lastStep}>
							<strong>4. Send it for review.</strong> Return to the session in the dashboard and
							click &quot;Ready to review&quot; only after the finished files are in &quot;
							{deliverablesFolderName}&quot;.
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
const menuNotice = {
	backgroundColor: "#3a3a3a",
	border: "1px solid #5a5a5a",
	borderRadius: "12px",
	color: "#fafafa",
	fontSize: "14px",
	lineHeight: "22px",
	margin: "0 0 20px",
	padding: "16px"
};
const workflow = { margin: "0 0 24px" };
const step = { ...paragraph, margin: "0 0 16px" };
const stepHeading = { ...paragraph, margin: "0 0 8px" };
const substep = { ...paragraph, margin: "0 0 8px", paddingLeft: "16px" };
const lastSubstep = { ...paragraph, margin: "0 0 16px", paddingLeft: "16px" };
const lastStep = { ...paragraph, margin: "0" };
const signoff = { ...paragraph, margin: "0 0 4px" };
const signature = { ...paragraph, fontWeight: "700", margin: "0" };
