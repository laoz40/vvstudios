import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const REMINDER_WINDOW_START_MS = 12 * 60 * 60 * 1000;
const REMINDER_WINDOW_END_MS = 25 * 60 * 60 * 1000;
const REMINDER_BATCH_SIZE = 50;

export const sendDueBookingReminderEmails = internalAction({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const bookings = await ctx.runQuery(internal.bookings.listBookingsDueForReminderEmail, {
			windowStart: now + REMINDER_WINDOW_START_MS,
			windowEnd: now + REMINDER_WINDOW_END_MS,
			limit: REMINDER_BATCH_SIZE,
		});

		for (const booking of bookings) {
			await ctx.runAction(internal.googleCalendar.sendBookingReminderEmailForBooking, {
				bookingId: booking._id,
			});
		}

		return null;
	},
});
