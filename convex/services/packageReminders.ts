import { err, ok } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { sendPackageExpiryReminderEmail, sendPackagePaymentReminderEmail } from "#convex/lib/email";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packageScheduling";
import {
	hasSentPackageReminder,
	validatePackageReminderClaim,
	type PackageReminderType
} from "#convex/lib/packageReminders";
import {
	getTimeZoneDateParts,
	getTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "#convex/lib/reminderScheduleTime";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";

const MAX_PACKAGE_SESSIONS = 12;
const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PackageReminderArgs = {
	multiBookingId: Doc<"multiBookingPackages">["_id"];
	reminderType: PackageReminderType;
};

export async function listPackagesDueForPaymentReminderService(
	ctx: QueryCtx,
	args: { invoiceDueStart: number; invoiceDueEnd: number; limit?: number }
) {
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
			(packageFromDb) => !hasSentPackageReminder(packageFromDb.packageReminderState, "payment")
		)
		.slice(0, limit);
}

export async function listPackagesPotentiallyDueForExpiryReminderService(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
) {
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
			(packageFromDb) => !hasSentPackageReminder(packageFromDb.packageReminderState, "expiry")
		)
		.slice(0, limit);

	return await Promise.all(
		eligiblePackages.map(async (packageFromDb) => ({
			...packageFromDb,
			remainingSessions:
				packageFromDb.packageSize -
				(
					await getCapacityConsumingPackageSessions(
						ctx,
						packageFromDb._id,
						packageFromDb.packageSize
					)
				).length
		}))
	);
}

export function claimPackageReminderService(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return okOrThrow(ctx.db.get(args.multiBookingId))
		.andThen((packageFromDb) =>
			packageFromDb ? ok(packageFromDb) : err({ reason: "PACKAGE_NOT_FOUND" as const })
		)
		.andThen((packageFromDb) => validatePackageReminderClaim(packageFromDb, args.reminderType))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, {
						packageReminderState: {
							type: args.reminderType,
							status: "claimed",
							claimedAt: args.now
						}
					})
					.then(() => null)
			)
		);
}

export function markPackageReminderSentService(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return ensurePackageExists(ctx, args.multiBookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.multiBookingId, {
					packageReminderState: { type: args.reminderType, status: "sent", sentAt: args.now }
				})
				.then(() => null)
		)
	);
}

export function markPackageReminderFailedService(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return ensurePackageExists(ctx, args.multiBookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.multiBookingId, {
					packageReminderState: {
						type: args.reminderType,
						status: "failed",
						failureCode: args.failureCode
					}
				})
				.then(() => null)
		)
	);
}

function ensurePackageExists(ctx: MutationCtx, multiBookingId: Doc<"multiBookingPackages">["_id"]) {
	return okOrThrow(ctx.db.get(multiBookingId)).andThen((packageFromDb) =>
		packageFromDb ? ok(null) : err({ reason: "PACKAGE_NOT_FOUND" as const })
	);
}

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

	// Reminders are non-critical, so isolate each package to ensure one failure does not block the rest.
	await Promise.all(
		paymentPackages.map(async (packageRecord) => {
			try {
				const claimResult = await fromConvexTuple(
					ctx.runMutation(internal.packageReminders.claimPackageReminder, {
						multiBookingId: packageRecord._id,
						now,
						reminderType: "payment"
					})
				);
				if (claimResult.isErr()) return;

				const sendResult = await sendPackagePaymentReminderEmail({
					email: packageRecord.email,
					invoiceDueAt: packageRecord.invoiceDueAt,
					name: packageRecord.name,
					requestDate: packageRecord.createdAt
				});
				if (sendResult.isOk()) {
					await fromConvexTuple(
						ctx.runMutation(internal.packageReminders.markPackageReminderSent, {
							multiBookingId: packageRecord._id,
							now,
							reminderType: "payment"
						})
					);
					return;
				}

				await fromConvexTuple(
					ctx.runMutation(internal.packageReminders.markPackageReminderFailed, {
						failureCode: sendResult.error.reason,
						multiBookingId: packageRecord._id,
						reminderType: "payment"
					})
				);
			} catch (error) {
				console.error(`Failed to process payment reminder for package ${packageRecord._id}`, error);
			}
		})
	);
}

async function sendPackageExpiryRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const today = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
	const expiryRange = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE, MAX_PACKAGE_SESSIONS * 7);
	const expiryPackages = await ctx.runQuery(
		internal.packageReminders.listPackagesPotentiallyDueForExpiryReminder,
		{ expiresAfter: today.dayStart, expiresBefore: expiryRange.dayEnd, limit: REMINDER_BATCH_SIZE }
	);

	// Reminders are non-critical, so isolate each package to ensure one failure does not block the rest.
	await Promise.all(
		expiryPackages.map(async (packageRecord) => {
			try {
				const { expiresAt, remainingSessions } = packageRecord;
				if (
					expiresAt === undefined ||
					remainingSessions === 0 ||
					getSydneyCalendarDayNumber(expiresAt) - getSydneyCalendarDayNumber(now) >
						remainingSessions * 7
				) {
					return;
				}

				const claimResult = await fromConvexTuple(
					ctx.runMutation(internal.packageReminders.claimPackageReminder, {
						multiBookingId: packageRecord._id,
						now,
						reminderType: "expiry"
					})
				);
				if (claimResult.isErr()) return;

				const sendResult = await sendPackageExpiryReminderEmail({
					email: packageRecord.email,
					expiresAt,
					name: packageRecord.name,
					remainingSessions
				});
				if (sendResult.isOk()) {
					await fromConvexTuple(
						ctx.runMutation(internal.packageReminders.markPackageReminderSent, {
							multiBookingId: packageRecord._id,
							now,
							reminderType: "expiry"
						})
					);
					return;
				}

				await fromConvexTuple(
					ctx.runMutation(internal.packageReminders.markPackageReminderFailed, {
						failureCode: sendResult.error.reason,
						multiBookingId: packageRecord._id,
						reminderType: "expiry"
					})
				);
			} catch (error) {
				console.error(`Failed to process expiry reminder for package ${packageRecord._id}`, error);
			}
		})
	);
}

// If processing throws after claiming a reminder, that reminder stays claimed and will not retry.
// Handling that rare case would require expiring claims, scheduling a targeted retry, and preventing
// the original attempt from later overwriting the retry. We intentionally omit that complexity because
// these are non-critical reminders; preventing duplicate emails is more important than guaranteed delivery.
export async function sendDuePackageReminders(ctx: ActionCtx, nowDate: Date) {
	await sendPackagePaymentRemindersDueToday(ctx, nowDate);
	await sendPackageExpiryRemindersDueToday(ctx, nowDate);
}
