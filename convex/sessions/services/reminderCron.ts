import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { sendDuePackageReminders } from "#convex/packages/services/reminders";
import {
	loadDueSessionReminderBookings,
	sendSessionReminderEmails
} from "#convex/sessions/lib/reminderCron";

function loadSessionRemindersAfterPackageReminders(ctx: ActionCtx, nowDate: Date) {
	return sendDuePackageReminders(ctx, nowDate).andThen(() =>
		loadDueSessionReminderBookings(ctx, nowDate)
	);
}

export function sendDueSessionAndPackageReminders(
	ctx: ActionCtx,
	nowDate: Date
): ResultAsync<null, never> {
	return loadSessionRemindersAfterPackageReminders(ctx, nowDate).andThen((bookings) =>
		sendSessionReminderEmails(ctx, bookings)
	);
}
