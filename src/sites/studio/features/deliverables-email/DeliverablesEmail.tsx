import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { FirstTimeDeliverablesEmail } from "#studio/features/deliverables-email/FirstTimeDeliverablesEmail";
import { RecurringDeliverablesEmail } from "#studio/features/deliverables-email/RecurringDeliverablesEmail";

export interface DeliverablesEmailProps {
	bookingDate: string;
	driveLink: string;
	emailVariant: DeliverablesEmailVariant;
	name: string;
	signoffName: string;
}

export function DeliverablesEmail({
	bookingDate,
	driveLink,
	emailVariant,
	name,
	signoffName,
}: DeliverablesEmailProps) {
	const props = {
		bookingDate,
		driveLink,
		name,
		signoffName,
	};

	if (emailVariant === "first-time") {
		return <FirstTimeDeliverablesEmail {...props} />;
	}

	return <RecurringDeliverablesEmail {...props} />;
}
