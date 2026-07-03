import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { err, ok, type Result } from "../../src/lib/result";
import { sendMultiBookingScheduleEmail } from "./email";

export function buildMultiBookingScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/multi-booking/${encodeURIComponent(token)}`, baseUrl);
	return url.toString();
}

type MultiBookingScheduleEmailArgs = Parameters<typeof sendMultiBookingScheduleEmail>[0];

export async function sendAndRecordMultiBookingScheduleEmail(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; email: MultiBookingScheduleEmailArgs }
): Promise<
	Result<
		{ scheduleEmailStatus: "sent" },
		| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
		| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
		| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" }
	>
> {
	// First try to send the schedule email. The database status is updated after we know the result.
	const [scheduleEmailError] = await sendMultiBookingScheduleEmail(args.email);

	if (scheduleEmailError !== null) {
		// Email failed, so record that failure on the package before returning the email error.
		const [statusUpdateError] = await ctx.runMutation(
			internal.bookings.markMultiBookingScheduleEmailAttemptInternal,
			{ multiBookingId: args.multiBookingId, status: "failed" }
		);

		if (statusUpdateError !== null) {
			// The email failed, but we also could not save that failed status.
			return err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" });
		}

		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" });
	}

	// Known edge case: see convex/googleCalendar.ts:573.
	const [statusUpdateError] = await ctx.runMutation(
		internal.bookings.markMultiBookingScheduleEmailAttemptInternal,
		{ multiBookingId: args.multiBookingId, status: "sent" }
	);

	if (statusUpdateError !== null) {
		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" });
	}

	return ok({ scheduleEmailStatus: "sent" as const });
}
