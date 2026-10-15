import { okAsync, ResultAsync, ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const sessions = yield* getCapacityConsumingPackageSessions(
			ctx,
			record._id,
			record.packageSize
		);

		return ok(expiryReminderCandidate(record, sessions));
	});
}

function enrichExpiryCandidates(ctx: QueryCtx, records: Doc<"packages">[]) {
	return ResultAsync.combine(
		records.map((record) => enrichPackageExpiryReminderCandidate(ctx, record))
	);
}

export function listPackagesPotentiallyDueForExpiryReminderService(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
) {
	return safeTry(async function* () {
		const packages = yield* listPackagesInExpiryReminderWindow(ctx, args);
		const eligiblePackages = eligibleExpiryCandidates(args, packages);
		const candidates = yield* enrichExpiryCandidates(ctx, eligiblePackages);

		return ok(candidates);
	});
}

function sendClaimedExpiryReminder(ctx: ActionCtx, now: number, record: DueExpiryCandidate) {
	return safeTry(async function* () {
		yield* sendPackageExpiryReminderEmail({
			packageId: record._id,
			email: record.email,
			expiresAt: record.expiresAt,
			name: record.name,
			remainingSessions: record.remainingSessions
		});
		const sentReminder = yield* markExpiryReminderSent(ctx, now, record);

		return ok(sentReminder);
	}).orElse((error) => markExpiryReminderFailed(ctx, record, error));
}

function deliverEligibleExpiryReminder(ctx: ActionCtx, now: number, record: DueExpiryCandidate) {
	return safeTry(async function* () {
		yield* claimExpiryReminder(ctx, now, record);
		const result = yield* sendClaimedExpiryReminder(ctx, now, record);

		return ok(result);
	}).orElse(() => okAsync(null));
}

function processPackageExpiryReminder(
	ctx: ActionCtx,
	now: number,
	record: PackageExpiryReminderCandidate
) {
	return isolateExpiryReminder(
		safeTry(async function* () {
			yield* ResultAsync.combine(
				selectDueExpiryReminders(record, now).map((due) =>
					deliverEligibleExpiryReminder(ctx, now, due)
				)
			);

			return ok(null);
		}),
		record
	);
}

function processExpiryCandidates(
	ctx: ActionCtx,
	nowDate: Date,
	records: PackageExpiryReminderCandidate[]
): ResultAsync<null, never> {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			records.map((record) => processPackageExpiryReminder(ctx, reminderTimestamp(nowDate), record))
		);

		return ok(null);
	});
}

// Reminder failures remain isolated; a claimed reminder does not retry after an infrastructure failure.
export function sendDuePackageReminders(ctx: ActionCtx, nowDate: Date): ResultAsync<null, never> {
	return safeTry(async function* () {
		const dueCandidates = yield* queryDueExpiryCandidates(ctx, nowDate);
		const result = yield* processExpiryCandidates(ctx, nowDate, dueCandidates);

		return ok(result);
	});
}
