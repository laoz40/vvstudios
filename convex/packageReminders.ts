import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "./_generated/server";
import {
	claimPackageReminderService,
	listPackagesDueForPaymentReminderService,
	listPackagesPotentiallyDueForExpiryReminderService,
	markPackageReminderFailedService,
	markPackageReminderSentService
} from "./services/packageReminders";
export { sendDuePackageReminders } from "./services/packageReminders";

export const listPackagesDueForPaymentReminder = internalQuery({
	args: { invoiceDueStart: v.number(), invoiceDueEnd: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesDueForPaymentReminderService(ctx, args)
});

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesPotentiallyDueForExpiryReminderService(ctx, args)
});

export const claimPackageReminder = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: (ctx, args) => claimPackageReminderService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderSent = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: (ctx, args) => markPackageReminderSentService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReminderFailed = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		failureCode: v.string()
	},
	handler: (ctx, args) => markPackageReminderFailedService(ctx, args).match(tupleOk, tupleErr)
});
