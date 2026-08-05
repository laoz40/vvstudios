import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import {
	claimPackageReminderService,
	listPackagesDueForPaymentReminderService,
	listPackagesPotentiallyDueForExpiryReminderService,
	markPackageReminderFailedService,
	markPackageReminderSentService
} from "./services/packageReminders";
import type { PackageReminderType } from "./lib/packageReminders";

export { sendDuePackageReminders } from "./services/packageReminders";

export const listPackagesDueForPaymentReminder = internalQuery({
	args: { invoiceDueStart: v.number(), invoiceDueEnd: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesDueForPaymentReminderHandler(ctx, args)
});

function listPackagesDueForPaymentReminderHandler(
	ctx: QueryCtx,
	args: { invoiceDueStart: number; invoiceDueEnd: number; limit?: number }
) {
	return listPackagesDueForPaymentReminderService(ctx, args);
}

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: (ctx, args) => listPackagesPotentiallyDueForExpiryReminderHandler(ctx, args)
});

function listPackagesPotentiallyDueForExpiryReminderHandler(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
) {
	return listPackagesPotentiallyDueForExpiryReminderService(ctx, args);
}

export const claimPackageReminder = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: (ctx, args) => claimPackageReminderHandler(ctx, args)
});

function claimPackageReminderHandler(
	ctx: MutationCtx,
	args: {
		multiBookingId: Id<"multiBookingPackages">;
		reminderType: PackageReminderType;
		now: number;
	}
) {
	return claimPackageReminderService(ctx, args).match(tupleOk, tupleErr);
}

export const markPackageReminderSent = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: (ctx, args) => markPackageReminderSentHandler(ctx, args)
});

function markPackageReminderSentHandler(
	ctx: MutationCtx,
	args: {
		multiBookingId: Id<"multiBookingPackages">;
		reminderType: PackageReminderType;
		now: number;
	}
) {
	return markPackageReminderSentService(ctx, args).match(tupleOk, tupleErr);
}

export const markPackageReminderFailed = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		failureCode: v.string()
	},
	handler: (ctx, args) => markPackageReminderFailedHandler(ctx, args)
});

function markPackageReminderFailedHandler(
	ctx: MutationCtx,
	args: {
		multiBookingId: Id<"multiBookingPackages">;
		reminderType: PackageReminderType;
		failureCode: string;
	}
) {
	return markPackageReminderFailedService(ctx, args).match(tupleOk, tupleErr);
}
