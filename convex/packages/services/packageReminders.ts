import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, QueryCtx } from "#convex/_generated/server";
import { sendPackageExpiryReminderEmail } from "#convex/email/services/packageReminderEmails";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/packageScheduling";
import {
	hasSentPackageReminder,
	listPackagesInExpiryReminderWindow
} from "#convex/packages/lib/packageReminders";
import {
	getTimeZoneDate,
	getTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "#convex/shared/lib/reminderScheduleTime";
import { fromConvexTuple } from "#convex/shared/lib/result";

const MAX_PACKAGE_SESSIONS = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PackageExpiryReminderCandidate = Doc<"packages"> & { remainingSessions: number };

async function enrichPackageExpiryReminderCandidate(ctx: QueryCtx, packageFromDb: Doc<"packages">) {
	const sessionsResult = await getCapacityConsumingPackageSessions(
		ctx,
		packageFromDb._id,
		packageFromDb.packageSize
	);

	if (sessionsResult.isErr()) {
		throw new Error("getCapacityConsumingPackageSessions failed");
	}

	return {
		...packageFromDb,
		remainingSessions: packageFromDb.packageSize - sessionsResult.value.length
	};
}

export async function listPackagesPotentiallyDueForExpiryReminderService(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
): Promise<PackageExpiryReminderCandidate[]> {
	const limit = args.limit ?? REMINDER_BATCH_SIZE;

	const packagesInWindow = await listPackagesInExpiryReminderWindow(ctx, args);

	const eligiblePackages = packagesInWindow
		.filter(
			(packageFromDb) => !hasSentPackageReminder(packageFromDb.packageReminderState, "expiry")
		)
		.slice(0, limit);

	return await Promise.all(
		eligiblePackages.map((packageFromDb: Doc<"packages">) =>
			enrichPackageExpiryReminderCandidate(ctx, packageFromDb)
		)
	);
}

const getSydneyCalendarDayNumber = (timestamp: number) => {
	const { year, month, day } = getTimeZoneDate(new Date(timestamp), REMINDER_TIME_ZONE);

	return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

async function processPackageExpiryReminder(
	ctx: ActionCtx,
	now: number,
	packageRecord: PackageExpiryReminderCandidate
) {
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
			ctx.runMutation(internal.packages.packageReminders.claimPackageReminder, {
				packageId: packageRecord._id,
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
				ctx.runMutation(internal.packages.packageReminders.markPackageReminderSent, {
					packageId: packageRecord._id,
					now,
					reminderType: "expiry"
				})
			);

			return;
		}

		await fromConvexTuple(
			ctx.runMutation(internal.packages.packageReminders.markPackageReminderFailed, {
				failureCode: sendResult.error.reason,
				packageId: packageRecord._id,
				reminderType: "expiry"
			})
		);
	} catch (error) {
		console.error(`Failed to process expiry reminder for package ${packageRecord._id}`, error);
	}
}

async function sendPackageExpiryRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const today = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
	const expiryRange = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE, MAX_PACKAGE_SESSIONS * 7);

	const expiryPackages = await ctx.runQuery(
		internal.packages.packageReminders.listPackagesPotentiallyDueForExpiryReminder,
		{ expiresAfter: today.dayStart, expiresBefore: expiryRange.dayEnd, limit: REMINDER_BATCH_SIZE }
	);

	// Reminders are non-critical, so isolate each package to ensure one failure does not block the rest.
	await Promise.all(
		expiryPackages.map((packageRecord: PackageExpiryReminderCandidate) =>
			processPackageExpiryReminder(ctx, now, packageRecord)
		)
	);
}

// If processing throws after claiming a reminder, that reminder stays claimed and will not retry.
// Handling that rare case would require expiring claims, scheduling a targeted retry, and preventing
// the original attempt from later overwriting the retry. We intentionally omit that complexity because
// these are non-critical reminders; preventing duplicate emails is more important than guaranteed delivery.
export async function sendDuePackageReminders(ctx: ActionCtx, nowDate: Date) {
	await sendPackageExpiryRemindersDueToday(ctx, nowDate);
}
