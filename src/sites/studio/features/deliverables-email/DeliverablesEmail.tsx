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
	signoffName: string;
}

export function DeliverablesEmail({
	bookingDate,
	driveLink,
	editLabel,
	editorNotes,
	emailVariant,
	name,
	signoffName
}: DeliverablesEmailProps) {
	const props = { bookingDate, driveLink, editLabel, editorNotes, name, signoffName };

	if (emailVariant === "first-time") {
		return <FirstTimeDeliverablesEmail {...props} />;
	}

	return <RecurringDeliverablesEmail {...props} />;
}
