const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";

	return `${hours}:${minutes}`;
});

export interface BusyPeriod {
	end: string;
	start: string;
}

export function getCurrentMonthKey() {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function getAvailableTimesForBusyPeriods({
	busyPeriods,
	duration,
}: {
	busyPeriods: BusyPeriod[];
	duration: string;
}) {
	const durationMinutes = getDurationMinutes(duration);
	const busyRanges = busyPeriods.map((period) => ({
		endMinutes: parseReadableTimeToMinutes(period.end),
		startMinutes: parseReadableTimeToMinutes(period.start),
	}));

	return TIME_OPTIONS.filter((time) => {
		const startMinutes = parseTimeToMinutes(time);
		const endMinutes = startMinutes + durationMinutes;

		return !busyRanges.some((busyRange) => {
			return startMinutes < busyRange.endMinutes && endMinutes > busyRange.startMinutes;
		});
	});
}

function parseTimeToMinutes(time: string) {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

function getDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	return 60;
}

function parseReadableTimeToMinutes(time: string) {
	const match = time.trim().match(/^(\d{1,2}):(\d{2})\s([AP]M)$/i);
	if (!match) {
		return 0;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const meridiem = match[3].toUpperCase();
	const normalizedHours = (hours % 12) + (meridiem === "PM" ? 12 : 0);

	return normalizedHours * 60 + minutes;
}
