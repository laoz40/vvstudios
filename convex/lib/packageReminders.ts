import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

export type PackageReminderType = "payment" | "expiry";
export type PackageReminderClaimError =
	| { reason: "PACKAGE_PAYMENT_REMINDER_NOT_SENDABLE" }
	| { reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" }
	| { reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" };

export function hasSentPackageReminder(
	reminderState: Doc<"multiBookingPackages">["packageReminderState"],
	reminderType: PackageReminderType
) {
	return reminderState?.type === reminderType && reminderState.status === "sent";
}

export function validatePackageReminderClaim(
	multiBookingPackage: Doc<"multiBookingPackages">,
	reminderType: PackageReminderType
): Result<null, PackageReminderClaimError> {
	switch (reminderType) {
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
			const exhaustiveReminderType: never = reminderType;
			return exhaustiveReminderType;
		}
	}

	const reminderState = multiBookingPackage.packageReminderState;
	if (reminderState?.status === "claimed" || hasSentPackageReminder(reminderState, reminderType)) {
		return err({ reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" });
	}

	return ok(null);
}
