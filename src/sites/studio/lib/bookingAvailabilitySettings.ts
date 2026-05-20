export interface BookingDaySchedule {
	endTime: string;
	startTime: string;
}

export interface BookingAvailabilitySettings {
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	maxDaysAhead: number;
	weekSchedule: BookingDaySchedule[];
}

export const DEFAULT_BOOKING_START_TIME = "08:00";
export const DEFAULT_BOOKING_END_TIME = "22:00";
export const BOOKING_LEAD_TIME_MINUTES = 12 * 60;
export const BOOKING_EVENT_BUFFER_MINUTES = 30;
export const BOOKING_MAX_DAYS_AHEAD = 60;

export const DEFAULT_BOOKING_WEEK_SCHEDULE: BookingDaySchedule[] = [
	{ startTime: "10:00", endTime: "21:00" }, // Sunday
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	{ startTime: DEFAULT_BOOKING_START_TIME, endTime: "21:00" },
];

export const DEFAULT_BOOKING_AVAILABILITY_SETTINGS: BookingAvailabilitySettings = {
	eventBufferMinutes: BOOKING_EVENT_BUFFER_MINUTES,
	leadTimeMinutes: BOOKING_LEAD_TIME_MINUTES,
	maxDaysAhead: BOOKING_MAX_DAYS_AHEAD,
	weekSchedule: DEFAULT_BOOKING_WEEK_SCHEDULE,
};
