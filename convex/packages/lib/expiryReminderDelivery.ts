import { ok, okAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { hasSentPackageReminder } from "#convex/packages/lib/reminders";
import {
	getTimeZoneDate,
	getTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "#convex/shared/lib/reminderScheduleTime";
import { fromConvexTuple } from "#convex/shared/lib/result";

export type PackageExpiryReminderCandidate = Doc<"packages"> & { remainingSessions: number };

export function expiryReminderCandidate(record: Doc<"packages">, sessions: Doc<"bookings">[]) {
	return { ...record, remainingSessions: record.packageSize - sessions.length };
}

export function eligibleExpiryCandidates(args: { limit?: number }, records: Doc<"packages">[]) {
	return records
		.filter((record) => !hasSentPackageReminder(record.packageReminderState, "expiry"))
		.slice(0, args.limit ?? REMINDER_BATCH_SIZE);
}

function calendarDay(timestamp: number) {
	const { year, month, day } = getTimeZoneDate(new Date(timestamp), REMINDER_TIME_ZONE);

	return Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
}

export type DueExpiryCandidate = PackageExpiryReminderCandidate & { expiresAt: number };

export function dueExpiryReminder(record: PackageExpiryReminderCandidate, now: number) {
	const { expiresAt, remainingSessions } = record;

	if (
		expiresAt === undefined ||
		remainingSessions === 0 ||
		calendarDay(expiresAt) - calendarDay(now) > remainingSessions * 7
	)
		return null;

	return { ...record, expiresAt };
}

export function selectDueExpiryReminders(record: PackageExpiryReminderCandidate, now: number) {
	const due = dueExpiryReminder(record, now);

	return due === null ? [] : [due];
}

export function claimExpiryReminder(
	ctx: ActionCtx,
	now: number,
	record: PackageExpiryReminderCandidate
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.reminders.claimPackageReminder, {
			packageId: record._id,
			now,
			reminderType: "expiry"
		})
	);
}

export function markExpiryReminderSent(
	ctx: ActionCtx,
	now: number,
	record: PackageExpiryReminderCandidate
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.reminders.markPackageReminderSent, {
			packageId: record._id,
			now,
			reminderType: "expiry"
		})
	)
		.map(() => null)
		.orElse(() => okAsync(null));
}

export function markExpiryReminderFailed(
	ctx: ActionCtx,
	record: PackageExpiryReminderCandidate,
	error: { reason: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.reminders.markPackageReminderFailed, {
			failureCode: error.reason,
			packageId: record._id,
			reminderType: "expiry"
		})
	)
		.map(() => null)
		.orElse(() => okAsync(null));
}

export function isolateExpiryReminder(
	result: ResultAsync<null, { reason: string }>,
	record: PackageExpiryReminderCandidate
): ResultAsync<null, never> {
	return new ResultAsync(
		Promise.resolve(result)
			.then(() => ok(null))
			.catch((error) => {
				console.error(`Failed to process expiry reminder for package ${record._id}`, error);

				return ok(null);
			})
	);
}

export function queryDueExpiryCandidates(ctx: ActionCtx, nowDate: Date) {
	const today = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
	const expiryRange = getTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE, 12 * 7);

	return fromConvexTuple(
		ctx.runQuery(internal.packages.reminders.listPackagesPotentiallyDueForExpiryReminder, {
			expiresAfter: today.dayStart,
			expiresBefore: expiryRange.dayEnd,
			limit: REMINDER_BATCH_SIZE
		})
	);
}

export function reminderTimestamp(date: Date) {
	return date.getTime();
}
