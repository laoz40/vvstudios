const MS_PER_MINUTE = 60 * 1000;

export function isPackageSessionLocked(
	sessionStartAt: number,
	leadTimeMinutes: number,
	now = Date.now()
) {
	return sessionStartAt - now <= leadTimeMinutes * MS_PER_MINUTE;
}

export function formatNoticeWindowLabel(leadTimeMinutes: number) {
	const hours = leadTimeMinutes / 60;

	if (Number.isInteger(hours)) {
		return `${hours} ${hours === 1 ? "hour" : "hours"}`;
	}

	return `${leadTimeMinutes} ${leadTimeMinutes === 1 ? "minute" : "minutes"}`;
}

export function getPackageSchedulingProgressMessage(
	packageSize: number,
	scheduledSessionCount: number
) {
	const sessionsRemaining = packageSize - scheduledSessionCount;

	if (sessionsRemaining <= 0) {
		return "All sessions are scheduled. Your booking is complete.";
	}

	const sessionLabel = sessionsRemaining === 1 ? "session" : "sessions";
	return `Schedule ${sessionsRemaining} more ${sessionLabel} to complete your booking.`;
}
