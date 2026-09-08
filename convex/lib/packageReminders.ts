import { err, ok, type Result } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc } from "#convex/_generated/dataModel";

export type PackageReminderType = "payment" | "expiry";
export type PackageReminderClaimError =
	| { reason: "PACKAGE_PAYMENT_REMINDER_NOT_SENDABLE" }
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
	switch (reminderType) {
		case "payment":
			if (
				packageRecord.status !== "pending_payment" &&
				packageRecord.status !== "invoice_email_failed"
			) {
				return err({ reason: "PACKAGE_PAYMENT_REMINDER_NOT_SENDABLE" });
			}
			break;
		case "expiry":
			if (packageRecord.status !== "paid" && packageRecord.status !== "schedule_email_failed") {
				return err({ reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" });
			}
			break;
		default:
			return exhaustiveCheck(reminderType);
	}

	const reminderState = packageRecord.packageReminderState;
	if (reminderState?.status === "claimed" || hasSentPackageReminder(reminderState, reminderType)) {
		return err({ reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" });
	}

	return ok(null);
}
