import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx
} from "./_generated/server";
import {
	getTomorrowTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "./lib/reminderScheduleTime";
import { sendDuePackageReminders } from "./packageReminders";
import {
	claimReminderService,
	markReminderFailedService,
	markReminderSentService
} from "./services/sessionReminders";

export const listSessionsDueForReminderEmail = internalQuery({
	args: { dayStart: v.number(), dayEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_status_and_reminderEmailSentAt_and_sessionStartAt", (indexQuery) =>
				indexQuery
					.eq("status", "confirmed")
					.eq("reminderEmailSentAt", undefined)
					.gte("sessionStartAt", args.dayStart)
					.lt("sessionStartAt", args.dayEnd)
			)
			.take(args.limit ?? REMINDER_BATCH_SIZE);
	}
});

export const claimReminder = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => claimReminderHandler(ctx, args)
});

function claimReminderHandler(ctx: MutationCtx, args: { bookingId: Id<"bookings">; now: number }) {
	return claimReminderService(ctx, args).match(tupleOk, tupleErr);
}

export const markReminderSent = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => markReminderSentHandler(ctx, args)
});

function markReminderSentHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return markReminderSentService(ctx, args).match(tupleOk, tupleErr);
}

export const markReminderFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: (ctx, args) => markReminderFailedHandler(ctx, args)
});

function markReminderFailedHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string }
) {
	return markReminderFailedService(ctx, args).match(tupleOk, tupleErr);
}

export const sendDueReminders = internalAction({
	args: {},
	handler: async (ctx) => {
		const nowDate = new Date();
		await sendDuePackageReminders(ctx, nowDate);

		const { dayEnd, dayStart } = getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
		const bookings = await ctx.runQuery(internal.sessionReminders.listSessionsDueForReminderEmail, {
			dayEnd,
			dayStart,
			limit: REMINDER_BATCH_SIZE
		});

		// Reminders are non-critical, so isolate each booking to ensure one failure does not block the rest.
		for (const booking of bookings) {
			try {
				await ctx.runAction(internal.googleCalendar.sendSessionReminderEmail, {
					bookingId: booking._id
				});
			} catch (error) {
				console.error(`Failed to process session reminder for booking ${booking._id}`, error);
			}
		}

		return null;
	}
});
