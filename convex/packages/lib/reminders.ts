import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import { REMINDER_BATCH_SIZE } from "#convex/shared/lib/reminderScheduleTime";

export type PackageReminderType = "expiry";

export type PackageReminderClaimError =
	| { reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" }
	| { reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" };

export function hasSentPackageReminder(
	reminderState: Doc<"packages">["packageReminderState"],
	reminderType: PackageReminderType
) {
	return reminderState?.type === reminderType && reminderState.status === "sent";
}

export function validatePackageReminderClaim(
	packageRecord: Doc<"packages">,
	reminderType: PackageReminderType
): Result<null, PackageReminderClaimError> {
	if (packageRecord.status !== "paid" && packageRecord.status !== "schedule_email_failed") {
		return err({ reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" });
	}

	const reminderState = packageRecord.packageReminderState;

	if (reminderState?.status === "claimed" || hasSentPackageReminder(reminderState, reminderType)) {
		return err({ reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" });
	}

	return ok(null);
}

export function listPackagesInExpiryReminderWindow(
	ctx: QueryCtx,
	args: { expiresAfter: number; expiresBefore: number; limit?: number }
) {
	const limit = args.limit ?? REMINDER_BATCH_SIZE;

	return okOrThrow(
		Promise.all([
			ctx.db
				.query("packages")
				.withIndex("by_status_and_expiresAt", (query) =>
					query
						.eq("status", "paid")
						.gt("expiresAt", args.expiresAfter)
						.lt("expiresAt", args.expiresBefore)
				)
				.take(limit),
			ctx.db
				.query("packages")
				.withIndex("by_status_and_expiresAt", (query) =>
					query
						.eq("status", "schedule_email_failed")
						.gt("expiresAt", args.expiresAfter)
						.lt("expiresAt", args.expiresBefore)
				)
				.take(limit)
		])
	).map((rows) => rows.flat());
}
