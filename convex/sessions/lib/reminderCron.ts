import { okAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { tupleOk } from "#/lib/result";
import {
	getTomorrowTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "#convex/shared/lib/reminderScheduleTime";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { logError } from "#convex/shared/lib/logger";

export function sessionReminderQueryArgs(nowDate: Date) {
	return {
		...getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE),
		limit: REMINDER_BATCH_SIZE
	};
}

export function loadDueSessionReminderBookings(ctx: ActionCtx, nowDate: Date) {
	return fromConvexTuple(
		ctx.runQuery(
			internal.sessions.reminders.listSessionsDueForReminderEmail,
			sessionReminderQueryArgs(nowDate)
		)
	);
}

export function sendSessionReminderEmail(ctx: ActionCtx, booking: Doc<"bookings">) {
	return fromConvexTuple(
		ctx
			.runAction(internal.googleCalendar.calendar.sendSessionReminderEmail, {
				bookingId: booking._id
			})
			.catch((cause: unknown) => {
				logError(
					{
						operation: "reminders.processSession",
						bookingId: booking._id,
						reason: "UNEXPECTED_ERROR"
					},
					cause
				);

				return tupleOk(null);
			})
	)
		.map(() => null)
		.orElse(() => okAsync(null));
}

export function sendSessionReminderEmails(ctx: ActionCtx, bookings: Doc<"bookings">[]) {
	return ResultAsync.combine(bookings.map((booking) => sendSessionReminderEmail(ctx, booking))).map(
		() => null
	);
}
