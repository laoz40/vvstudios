import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendDuePackageReminders } from "#convex/packages/services/reminders";
import {
	loadDueSessionReminderBookings,
	sendSessionReminderEmails
} from "#convex/sessions/lib/reminderCron";

function loadSessionRemindersAfterPackageReminders(
	ctx: ActionCtx,
	nowDate: Date
): ResultAsync<Doc<"bookings">[], never> {
	return safeTry(async function* () {
		yield* sendDuePackageReminders(ctx, nowDate);

		return ok(yield* loadDueSessionReminderBookings(ctx, nowDate));
	});
}

export function sendDueSessionAndPackageReminders(
	ctx: ActionCtx,
	nowDate: Date
): ResultAsync<null, never> {
	return safeTry(async function* () {
		const bookings = yield* loadSessionRemindersAfterPackageReminders(ctx, nowDate);

		return ok(yield* sendSessionReminderEmails(ctx, bookings));
	});
}
