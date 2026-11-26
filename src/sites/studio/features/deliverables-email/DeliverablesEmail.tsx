import type { DeliverablesRevisionInfo } from "#/domain/revisions/rules";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { FirstTimeDeliverablesEmail } from "#studio/features/deliverables-email/FirstTimeDeliverablesEmail";
import { RecurringDeliverablesEmail } from "#studio/features/deliverables-email/RecurringDeliverablesEmail";

export interface DeliverablesEmailProps {
	bookingDate: string;
	driveLink: string;
	editLabel?: string;
	editorNotes?: string;
	emailVariant: DeliverablesEmailVariant;
	name: string;
	revisionInfo?: DeliverablesRevisionInfo;
	signoffName: string;
}

export function DeliverablesEmail({
	bookingDate,
	driveLink,
	editLabel,
	editorNotes,
	emailVariant,
	name,
	revisionInfo,
	signoffName
}: DeliverablesEmailProps) {
	const props = { bookingDate, driveLink, editLabel, editorNotes, name, revisionInfo, signoffName };

	if (emailVariant === "first-time") {
		return <FirstTimeDeliverablesEmail {...props} />;
	}

	return <RecurringDeliverablesEmail {...props} />;
}
