import type { Doc } from "#convex/_generated/dataModel";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import { internalAction, internalMutation, internalQuery } from "#convex/_generated/server";
import { REMINDER_BATCH_SIZE } from "#convex/lib/reminderScheduleTime";
import { sendDuePackageReminders } from "#convex/packageReminders";
import {
	claimSessionReminderEmail,
	getTomorrowSessionReminderWindow,
	listConfirmedSessionsDueForReminderEmail,
	writeSessionReminderEmailFailed,
	writeSessionReminderEmailSent
} from "#convex/services/sessions/sessionReminderMutationWorkflow";

export const listSessionsDueForReminderEmail = internalQuery({
	args: { dayStart: v.number(), dayEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) =>
		await listConfirmedSessionsDueForReminderEmail(ctx, args).match(
			(bookings) => bookings,
			() => []
		)
});

export const claimReminder = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => claimSessionReminderEmail(ctx, args).match(tupleOk, tupleErr)
});

export const markReminderSent = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => writeSessionReminderEmailSent(ctx, args).match(tupleOk, tupleErr)
});

export const markReminderFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: (ctx, args) => writeSessionReminderEmailFailed(ctx, args).match(tupleOk, tupleErr)
});

export const sendDueReminders = internalAction({
	args: {},
	handler: async (ctx) => {
		const nowDate = new Date();
		await sendDuePackageReminders(ctx, nowDate);

		const { dayEnd, dayStart } = getTomorrowSessionReminderWindow(nowDate);

		const bookings = await ctx.runQuery(internal.sessionReminders.listSessionsDueForReminderEmail, {
			dayEnd,
			dayStart,
			limit: REMINDER_BATCH_SIZE
		});

		await Promise.all(
			bookings.map(async (booking: Doc<"bookings">) => {
				try {
					await ctx.runAction(internal.googleCalendar.sendSessionReminderEmail, {
						bookingId: booking._id
					});
				} catch (error) {
					console.error(`Failed to process session reminder for booking ${booking._id}`, error);
				}
			})
		);

		return null;
	}
});
