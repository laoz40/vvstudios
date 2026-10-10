import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import { listPackagesPotentiallyDueForExpiryReminderService } from "#convex/packages/services/reminders";
import {
	claimPackageReminderEmail,
	writePackageReminderEmailFailed,
	writePackageReminderEmailSent
} from "#convex/packages/services/reminderMutations";

export { sendDuePackageReminders } from "#convex/packages/services/reminders";

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesPotentiallyDueForExpiryReminderService(ctx, args)
});

export const claimPackageReminder = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), now: v.number() },
	handler: (ctx, args) => claimPackageReminderEmail(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderSent = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), now: v.number() },
	handler: (ctx, args) => writePackageReminderEmailSent(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderFailed = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), failureCode: v.string() },
	handler: (ctx, args) => writePackageReminderEmailFailed(ctx, args).match(tupleOk, tupleErr)
});
