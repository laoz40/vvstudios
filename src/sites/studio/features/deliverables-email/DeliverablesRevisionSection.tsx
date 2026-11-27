import { Button, Section, Text } from "@react-email/components";
import {
	MAX_PAID_REVISION_ROUNDS,
	PAID_REVISION_PRICE_AUD,
	REVISION_WINDOW_BUSINESS_DAYS,
	type DeliverablesRevisionInfo
} from "#/domain/revisions/rules";

export function DeliverablesRevisionSection({
	revisionInfo
}: {
	revisionInfo?: DeliverablesRevisionInfo;
}) {
	if (revisionInfo === undefined) {
		return null;
	}

	const freeRevisionLabel =
		revisionInfo.freeRounds === 1 ? "1 free revision" : `${revisionInfo.freeRounds} free revisions`;

	return (
		<Section style={section}>
			<Text style={sectionTitle}>Revisions</Text>
			<Text style={paragraph}>
				Need changes? Request a revision within {REVISION_WINDOW_BUSINESS_DAYS} business days (by
				11:59 pm Sydney time, Mon–Fri).
			</Text>
			<Section style={buttonWrapper}>
				<Button
					href={revisionInfo.feedbackUrl}
					style={button}>
					Request Revisions
				</Button>
			</Section>
			<Text style={detailText}>
				<strong>Included:</strong> {freeRevisionLabel}
				{revisionInfo.scopeSummary ? ` (${revisionInfo.scopeSummary})` : ""}.
			</Text>
			<Text style={detailText}>
				<strong>How to submit:</strong> Include a timestamp (e.g. 01:23 or 01:23-01:45)
				{revisionInfo.requiresClipNumber ? ", clip number," : ""} and note for each change.
			</Text>
			<Text style={detailText}>
				<strong>Extra revisions:</strong> ${PAID_REVISION_PRICE_AUD} AUD (incl. GST) each, up to{" "}
				{MAX_PAID_REVISION_ROUNDS} extra revisions per edit.
			</Text>
		</Section>
	);
}

const section = { margin: "0 0 20px" };

const sectionTitle = {
	color: "#f5c400",
	fontSize: "13px",
	fontWeight: "600",
	margin: "0 0 8px",
	textTransform: "uppercase" as const
};

const paragraph = { color: "#fafafa", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };

const detailText = { color: "#fafafa", fontSize: "14px", lineHeight: "22px", margin: "0 0 8px" };

const buttonWrapper = { margin: "20px 0", textAlign: "center" as const };

const button = {
	backgroundColor: "#f5c400",
	borderRadius: "12px",
	color: "#1a1a1a",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 18px",
	textDecoration: "none"
};
