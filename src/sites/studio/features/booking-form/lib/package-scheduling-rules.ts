const MS_PER_MINUTE = 60 * 1000;

export function getPackageSessionLabel(slotNumber: number, packageSize: number) {
	return `Package ${slotNumber}/${packageSize}`;
}

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
