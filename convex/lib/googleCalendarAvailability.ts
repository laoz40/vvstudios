import { getAvailabilityRange, getEventDateTime, type BusyWindow } from "./bookingTimeUtils";

interface GoogleCalendarEventDateTimeRange {
	date?: string | null;
	dateTime?: string | null;
}

interface GoogleCalendarEventItem {
	status?: string | null;
	transparency?: string | null;
	start?: GoogleCalendarEventDateTimeRange | null;
	end?: GoogleCalendarEventDateTimeRange | null;
}

interface GoogleCalendarEventsListArgs {
	calendarId: string;
	eventTypes: ["default"];
	singleEvents: boolean;
	showDeleted: boolean;
	orderBy: "startTime";
	timeMax: string;
	timeMin: string;
}

interface GoogleCalendarEventsListResponse {
	data: {
		items?: GoogleCalendarEventItem[];
	};
}

interface GoogleCalendarLike {
	events: {
		list: (args: GoogleCalendarEventsListArgs) => Promise<GoogleCalendarEventsListResponse>;
	};
}

interface GetBusyWindowsArgs {
	calendar: GoogleCalendarLike;
	calendarId: string;
	date: string;
	timeZone: string;
}

// load calendar events for the date range and turn them into busy windows
export async function getBusyWindows({
	calendar,
	calendarId,
	date,
	timeZone,
}: GetBusyWindowsArgs): Promise<BusyWindow[]> {
	const { timeMin, timeMax } = getAvailabilityRange(date);

	const response = await calendar.events.list({
		calendarId,
		eventTypes: ["default"],
		singleEvents: true,
		showDeleted: false,
		orderBy: "startTime",
		timeMax,
		timeMin,
	});

	// skip events that should not block bookings and keep only start and end times
	return (response.data.items ?? []).flatMap((event) => {
		if (event.status === "cancelled" || event.transparency === "transparent") {
			return [];
		}

		const start = getEventDateTime(event.start, timeZone);
		const end = getEventDateTime(event.end, timeZone);

		if (!start || !end) {
			return [];
		}

		return [{ start, end }];
	});
}
