import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getTimeZoneDateParts, getTomorrowTimeZoneDayRange } from "./lib/reminderScheduleTime";

const REMINDER_BATCH_SIZE = 50;
const SYDNEY_TIME_ZONE = "Australia/Sydney";
const MORNING_REMINDER_HOUR = 9;
const AFTERNOON_REMINDER_HOUR = 12;
const EVENING_REMINDER_HOUR = 15;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 16;
const REMINDER_HOURS = [MORNING_REMINDER_HOUR, AFTERNOON_REMINDER_HOUR, EVENING_REMINDER_HOUR];

const getReminderHourForBooking = (sessionStartAt: number) => {
	const { hour } = getTimeZoneDateParts(new Date(sessionStartAt), SYDNEY_TIME_ZONE);

	if (hour < AFTERNOON_START_HOUR) {
		return MORNING_REMINDER_HOUR;
	}

	if (hour < EVENING_START_HOUR) {
		return AFTERNOON_REMINDER_HOUR;
	}

	return EVENING_REMINDER_HOUR;
};

export const sendDueBookingReminderEmails = internalAction({
	args: {},
	handler: async (ctx) => {
		const nowDate = new Date();
		const currentSydneyHour = getTimeZoneDateParts(nowDate, SYDNEY_TIME_ZONE).hour;

		if (!REMINDER_HOURS.includes(currentSydneyHour)) {
			return null;
		}

		const { dayEnd, dayStart } = getTomorrowTimeZoneDayRange(nowDate, SYDNEY_TIME_ZONE);
		const bookings = await ctx.runQuery(internal.bookings.listBookingsDueForReminderEmail, {
			dayEnd,
			dayStart,
			limit: REMINDER_BATCH_SIZE,
		});

		for (const booking of bookings) {
			if (getReminderHourForBooking(booking.sessionStartAt) !== currentSydneyHour) {
				continue;
			}

			await ctx.runAction(internal.googleCalendar.sendBookingReminderEmailForBooking, {
				bookingId: booking._id,
			});
		}

		return null;
	},
});
