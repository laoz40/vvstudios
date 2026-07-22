import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { err, ok, type Result } from "../../src/lib/result";
import { sendPackageScheduleEmail } from "./email";

export function buildPackageScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/package-schedule/${encodeURIComponent(token)}`, baseUrl);
	return url.toString();
}

type PackageScheduleEmailArgs = Parameters<typeof sendPackageScheduleEmail>[0];

export async function sendAndRecordPackageScheduleEmail(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; email: PackageScheduleEmailArgs }
): Promise<
	Result<
		{ scheduleEmailStatus: "sent" },
		| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
		| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
		| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" }
	>
> {
	// First try to send the schedule email. The database status is updated after we know the result.
	const [scheduleEmailError] = await sendPackageScheduleEmail(args.email);

	if (scheduleEmailError !== null) {
		// Email failed, so record that failure on the package before returning the email error.
		const [statusUpdateError] = await ctx.runMutation(
			internal.packages.markPackageScheduleEmailAttempt,
			{ multiBookingId: args.multiBookingId, status: "failed" }
		);

		if (statusUpdateError !== null) {
			// The email failed, but we also could not save that failed status.
			return err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" });
		}

		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" });
	}

	// Known edge case: see sendBookingInvoiceForBookingHandler in convex/googleCalendar.ts.
	const [statusUpdateError] = await ctx.runMutation(
		internal.packages.markPackageScheduleEmailAttempt,
		{ multiBookingId: args.multiBookingId, status: "sent" }
	);

	if (statusUpdateError !== null) {
		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" });
	}

	return ok({ scheduleEmailStatus: "sent" as const });
}
