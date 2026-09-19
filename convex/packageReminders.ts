import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import {
	claimPackageReminderService,
	listPackagesPotentiallyDueForExpiryReminderService,
	markPackageReminderFailedService,
	markPackageReminderSentService
} from "#convex/services/packageReminders";

export { sendDuePackageReminders } from "#convex/services/packageReminders";

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesPotentiallyDueForExpiryReminderService(ctx, args)
});

export const claimPackageReminder = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), now: v.number() },
	handler: (ctx, args) => claimPackageReminderService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderSent = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), now: v.number() },
	handler: (ctx, args) => markPackageReminderSentService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderFailed = internalMutation({
	args: { packageId: v.id("packages"), reminderType: v.literal("expiry"), failureCode: v.string() },
	handler: (ctx, args) => markPackageReminderFailedService(ctx, args).match(tupleOk, tupleErr)
});
