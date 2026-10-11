import { okAsync, ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, QueryCtx } from "#convex/_generated/server";
import { sendPackageExpiryReminderEmail } from "#convex/email/services/packageReminderEmails";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import { listPackagesInExpiryReminderWindow } from "#convex/packages/lib/reminders";
import {
	expiryReminderCandidate,
	eligibleExpiryCandidates,
	selectDueExpiryReminders,
	claimExpiryReminder,
	markExpiryReminderSent,
	markExpiryReminderFailed,
	isolateExpiryReminder,
	queryDueExpiryCandidates,
	reminderTimestamp,
	type PackageExpiryReminderCandidate as LibPackageExpiryReminderCandidate,
	type DueExpiryCandidate
} from "#convex/packages/lib/expiryReminderDelivery";

export type PackageExpiryReminderCandidate = LibPackageExpiryReminderCandidate;

function enrichPackageExpiryReminderCandidate(ctx: QueryCtx, record: Doc<"packages">) {
	return getCapacityConsumingPackageSessions(ctx, record._id, record.packageSize).map((sessions) =>
		expiryReminderCandidate(record, sessions)
	);
}

function enrichExpiryCandidates(ctx: QueryCtx, records: Doc<"packages">[]) {
	return ResultAsync.combine(
		records.map((record) => enrichPackageExpiryReminderCandidate(ctx, record))
	);
}

export function listPackagesPotentiallyDueForExpiryReminderService(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
): ResultAsync<PackageExpiryReminderCandidate[], never> {
	return listPackagesInExpiryReminderWindow(ctx, args)
		.map((records) => eligibleExpiryCandidates(args, records))
		.andThen((records) => enrichExpiryCandidates(ctx, records));
}

function sendClaimedExpiryReminder(ctx: ActionCtx, now: number, record: DueExpiryCandidate) {
	return sendPackageExpiryReminderEmail({
		email: record.email,
		expiresAt: record.expiresAt,
		name: record.name,
		remainingSessions: record.remainingSessions
	})
		.andThen(() => markExpiryReminderSent(ctx, now, record))
		.orElse((error) => markExpiryReminderFailed(ctx, record, error));
}

function deliverEligibleExpiryReminder(ctx: ActionCtx, now: number, record: DueExpiryCandidate) {
	return claimExpiryReminder(ctx, now, record)
		.andThen(() => sendClaimedExpiryReminder(ctx, now, record))
		.orElse(() => okAsync(null));
}

function processPackageExpiryReminder(
	ctx: ActionCtx,
	now: number,
	record: PackageExpiryReminderCandidate
) {
	return isolateExpiryReminder(
		ResultAsync.combine(
			selectDueExpiryReminders(record, now).map((due) =>
				deliverEligibleExpiryReminder(ctx, now, due)
			)
		).map(() => null),
		record
	);
}

function processExpiryCandidates(
	ctx: ActionCtx,
	nowDate: Date,
	records: PackageExpiryReminderCandidate[]
) {
	return ResultAsync.combine(
		records.map((record) => processPackageExpiryReminder(ctx, reminderTimestamp(nowDate), record))
	).map(() => null);
}

// Reminder failures remain isolated; a claimed reminder does not retry after an infrastructure failure.
export function sendDuePackageReminders(ctx: ActionCtx, nowDate: Date) {
	return queryDueExpiryCandidates(ctx, nowDate).andThen((records) =>
		processExpiryCandidates(ctx, nowDate, records)
	);
}
