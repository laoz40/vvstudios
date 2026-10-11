import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalAction, internalMutation, internalQuery } from "#convex/_generated/server";
import { sendDueSessionAndPackageReminders } from "#convex/sessions/services/reminderCron";
import {
	claimSessionReminderEmail,
	listConfirmedSessionsDueForReminderEmail,
	writeSessionReminderEmailFailed,
	writeSessionReminderEmailSent
} from "#convex/sessions/services/reminderMutations";

export const listSessionsDueForReminderEmail = internalQuery({
	args: { dayStart: v.number(), dayEnd: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) =>
		listConfirmedSessionsDueForReminderEmail(ctx, args).match(tupleOk, tupleErr)
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
	handler: (ctx) => sendDueSessionAndPackageReminders(ctx, new Date()).match(tupleOk, tupleErr)
});
