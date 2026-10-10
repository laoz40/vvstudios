import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { REMINDER_BATCH_SIZE } from "#convex/shared/lib/reminderScheduleTime";
import { sendDuePackageReminders } from "#convex/packages/services/reminders";
import { getTomorrowSessionReminderWindow } from "#convex/sessions/services/reminderMutations";

async function sendSessionReminderEmailStep(ctx: ActionCtx, booking: Doc<"bookings">) {
	try {
		await ctx.runAction(internal.googleCalendar.calendar.sendSessionReminderEmail, {
			bookingId: booking._id
		});
	} catch (error) {
		console.error(`Failed to process session reminder for booking ${booking._id}`, error);
	}
}

export async function sendDueSessionAndPackageReminders(ctx: ActionCtx, nowDate: Date) {
	await sendDuePackageReminders(ctx, nowDate);

	const { dayEnd, dayStart } = getTomorrowSessionReminderWindow(nowDate);

	const bookings = await ctx.runQuery(internal.sessions.reminders.listSessionsDueForReminderEmail, {
		dayEnd,
		dayStart,
		limit: REMINDER_BATCH_SIZE
	});

	await Promise.all(
		bookings.map((booking: Doc<"bookings">) => sendSessionReminderEmailStep(ctx, booking))
	);

	return null;
}
