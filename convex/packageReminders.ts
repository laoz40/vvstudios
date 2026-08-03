import { v } from "convex/values";
import { err, ok } from "#/lib/result";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type ActionCtx } from "#convex/_generated/server";
import {
	getTimeZoneDateParts,
	getTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "./lib/reminderScheduleTime";
import { sendPackageExpiryReminderEmail, sendPackagePaymentReminderEmail } from "./lib/email";
import { getCapacityConsumingPackageSessions } from "./lib/packageScheduling";

const MAX_PACKAGE_SESSIONS = 12;
const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PackageReminderType = "payment" | "expiry";

function hasSentPackageReminder(
	reminderState: Doc<"multiBookingPackages">["packageReminderState"],
	reminderType: PackageReminderType
) {
	return reminderState?.type === reminderType && reminderState.status === "sent";
}

export const listPackagesDueForPaymentReminder = internalQuery({
	args: { invoiceDueStart: v.number(), invoiceDueEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? REMINDER_BATCH_SIZE;
		const packagesByStatus = await Promise.all(
			(["pending_payment", "invoice_email_failed"] as const).map((status) =>
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_status_and_invoiceDueAt", (query) =>
						query
							.eq("status", status)
							.gte("invoiceDueAt", args.invoiceDueStart)
							.lt("invoiceDueAt", args.invoiceDueEnd)
					)
					.take(limit)
			)
		);

		return packagesByStatus
			.flat()
			.filter(
				(multiBookingPackage) =>
					!hasSentPackageReminder(multiBookingPackage.packageReminderState, "payment")
			)
			.slice(0, limit);
	}
});

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? REMINDER_BATCH_SIZE;
		const packagesByStatus = await Promise.all(
			(["paid", "schedule_email_failed"] as const).map((status) =>
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_status_and_expiresAt", (query) =>
						query
							.eq("status", status)
							.gt("expiresAt", args.expiresAfter)
							.lt("expiresAt", args.expiresBefore)
					)
					.take(limit)
			)
		);
		const eligiblePackages = packagesByStatus
			.flat()
			.filter(
				(multiBookingPackage) =>
					!hasSentPackageReminder(multiBookingPackage.packageReminderState, "expiry")
			)
			.slice(0, limit);

		return await Promise.all(
			eligiblePackages.map(async (multiBookingPackage) => ({
				...multiBookingPackage,
				remainingSessions:
					multiBookingPackage.packageSize -
					(
						await getCapacityConsumingPackageSessions(
							ctx,
							multiBookingPackage._id,
							multiBookingPackage.packageSize
						)
					).length
			}))
		);
	}
});

export const claimPackageReminder = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		switch (args.reminderType) {
			case "payment":
				if (
					multiBookingPackage.status !== "pending_payment" &&
					multiBookingPackage.status !== "invoice_email_failed"
				) {
					return err({ reason: "PACKAGE_PAYMENT_REMINDER_NOT_SENDABLE" });
				}
				break;
			case "expiry":
				if (
					multiBookingPackage.status !== "paid" &&
					multiBookingPackage.status !== "schedule_email_failed"
				) {
					return err({ reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" });
				}
				break;
			default: {
				const _exhaustive: never = args.reminderType;
				return _exhaustive;
			}
		}

		const reminderState = multiBookingPackage.packageReminderState;
		if (
			reminderState?.status === "claimed" ||
			hasSentPackageReminder(reminderState, args.reminderType)
		) {
			return err({ reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" });
		}

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: { type: args.reminderType, status: "claimed", claimedAt: args.now }
		});
		return ok({ multiBookingPackage });
	}
});

export const markPackageReminderSent = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: { type: args.reminderType, status: "sent", sentAt: args.now }
		});

		return ok({ updated: true });
	}
});

export const markPackageReminderFailed = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		failureCode: v.string()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: {
				type: args.reminderType,
				status: "failed",
				failureCode: args.failureCode
			}
		});

		return ok({ updated: true });
	}
});

const getSydneyCalendarDayNumber = (timestamp: number) => {
	const { year, month, day } = getTimeZoneDateParts(new Date(timestamp), REMINDER_TIME_ZONE);
	return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

async function sendPackagePaymentRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const paymentDueDay = getTimeZoneDayRange(
		nowDate,
		REMINDER_TIME_ZONE,
		PAYMENT_REMINDER_DAYS_BEFORE_DUE
	);
	const paymentPackages = await ctx.runQuery(
		internal.packageReminders.listPackagesDueForPaymentReminder,
		{
			invoiceDueEnd: paymentDueDay.dayEnd,
			invoiceDueStart: paymentDueDay.dayStart,
			limit: REMINDER_BATCH_SIZE
		}
	);

	for (const packageRecord of paymentPackages) {
		try {
			const [claimError] = await ctx.runMutation(internal.packageReminders.claimPackageReminder, {
				multiBookingId: packageRecord._id,
				now,
				reminderType: "payment"
			});
			if (claimError !== null) {
				continue;
			}

			const sendResult = await sendPackagePaymentReminderEmail({
				email: packageRecord.email,
				invoiceDueAt: packageRecord.invoiceDueAt,
				name: packageRecord.name,
				requestDate: packageRecord.createdAt
			});
			if (sendResult.isOk()) {
				await ctx.runMutation(internal.packageReminders.markPackageReminderSent, {
					multiBookingId: packageRecord._id,
					now,
					reminderType: "payment"
				});
				continue;
			}

			await ctx.runMutation(internal.packageReminders.markPackageReminderFailed, {
				failureCode: sendResult.error.reason,
				multiBookingId: packageRecord._id,
				reminderType: "payment"
			});
		} catch (error) {
			console.error(`Failed to process payment reminder for package ${packageRecord._id}`, error);
		}
	}
}

async function sendPackageExpiryRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const today = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
	const expiryRange = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE, MAX_PACKAGE_SESSIONS * 7);
	const expiryPackages = await ctx.runQuery(
		internal.packageReminders.listPackagesPotentiallyDueForExpiryReminder,
		{ expiresAfter: today.dayStart, expiresBefore: expiryRange.dayEnd, limit: REMINDER_BATCH_SIZE }
	);

	for (const packageRecord of expiryPackages) {
		try {
			const { expiresAt, remainingSessions } = packageRecord;
			if (
				expiresAt === undefined ||
				remainingSessions === 0 ||
				getSydneyCalendarDayNumber(expiresAt) - getSydneyCalendarDayNumber(now) >
					remainingSessions * 7
			) {
				continue;
			}

			const [claimError] = await ctx.runMutation(internal.packageReminders.claimPackageReminder, {
				multiBookingId: packageRecord._id,
				now,
				reminderType: "expiry"
			});
			if (claimError !== null) {
				continue;
			}

			const sendResult = await sendPackageExpiryReminderEmail({
				email: packageRecord.email,
				expiresAt,
				name: packageRecord.name,
				remainingSessions
			});
			if (sendResult.isOk()) {
				await ctx.runMutation(internal.packageReminders.markPackageReminderSent, {
					multiBookingId: packageRecord._id,
					now,
					reminderType: "expiry"
				});
				continue;
			}

			await ctx.runMutation(internal.packageReminders.markPackageReminderFailed, {
				failureCode: sendResult.error.reason,
				multiBookingId: packageRecord._id,
				reminderType: "expiry"
			});
		} catch (error) {
			console.error(`Failed to process expiry reminder for package ${packageRecord._id}`, error);
		}
	}
}

// If processing throws after claiming a reminder, that reminder stays claimed and will not retry.
// Handling that rare case would require expiring claims, scheduling a targeted retry, and preventing
// the original attempt from later overwriting the retry. We intentionally omit that complexity because
// these are non-critical reminders; preventing duplicate emails is more important than guaranteed delivery.
export async function sendDuePackageReminders(ctx: ActionCtx, nowDate: Date) {
	await sendPackagePaymentRemindersDueToday(ctx, nowDate);
	await sendPackageExpiryRemindersDueToday(ctx, nowDate);
}
