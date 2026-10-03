import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

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
