import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type {
	MarkPackagePaidAndCreateScheduleTokenResult,
	MarkPackageScheduleEmailAttemptResult
} from "#convex/packages";
import type { PackageLookupError, PaidPackageResult } from "#convex/services/packages";
import { sendPackageScheduleEmail } from "./email";

type PackageScheduleEmailArgs = Parameters<typeof sendPackageScheduleEmail>[0];
type PackageScheduleEmailResult = ResultAsync<
	null,
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" }
>;

export function buildPackageScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/package-schedule/${encodeURIComponent(token)}`, baseUrl);
	return url.toString();
}

export function markPackagePaid(
	ctx: ActionCtx,
	multiBookingId: Id<"multiBookingPackages">,
	paidAt: number
): ResultAsync<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return ResultAsync.fromSafePromise<MarkPackagePaidAndCreateScheduleTokenResult>(
		ctx.runMutation(internal.packages.markPackagePaidAndCreateScheduleToken, {
			multiBookingId,
			paidAt
		})
	).andThen(([paymentError, paymentResult]) => {
		if (paymentError !== null) {
			return err(paymentError);
		}

		return ok(paymentResult);
	});
}

export function sendAndRecordPackageScheduleEmail(
	ctx: ActionCtx,
	multiBookingId: Id<"multiBookingPackages">,
	email: PackageScheduleEmailArgs
): PackageScheduleEmailResult {
	return ResultAsync.fromSafePromise(sendPackageScheduleEmail(email)).andThen(([emailError]) => {
		if (emailError !== null) {
			// Record the failed email so an admin can retry the paid package lifecycle.
			return recordPackageScheduleEmailAttempt(ctx, multiBookingId, "failed")
				.mapErr(() => ({
					reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" as const
				}))
				.andThen(() => err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" as const }));
		}

		// Translate a failed status write into the workflow error the admin can act on.
		return recordPackageScheduleEmailAttempt(ctx, multiBookingId, "sent").mapErr(() => ({
			reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" as const
		}));
	});
}

function recordPackageScheduleEmailAttempt(
	ctx: ActionCtx,
	multiBookingId: Id<"multiBookingPackages">,
	status: "sent" | "failed"
): ResultAsync<null, { reason: "PACKAGE_NOT_FOUND" }> {
	return ResultAsync.fromSafePromise<MarkPackageScheduleEmailAttemptResult>(
		ctx.runMutation(internal.packages.markPackageScheduleEmailAttempt, { multiBookingId, status })
	).andThen(([statusError, statusResult]) => {
		if (statusError !== null) {
			return err(statusError);
		}

		return ok(statusResult);
	});
}
