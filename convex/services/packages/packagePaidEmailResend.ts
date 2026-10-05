"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import {
	buildPackagePaidEmailContext,
	type PaidPackageResult,
	refreshPackageScheduleToken
} from "#convex/lib/packages/packagePayment";
import { sendAndRecordPackagePaidEmail } from "#convex/services/packages/packagePaidEmailSend";
import { getPackageForAction } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type PackagePaidEmailError =
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" };

export type ResendPackageEmailError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" }
	| PackagePaidEmailError;

function isPaidPackageStatus(status: string) {
	return status === "paid" || status === "schedule_email_failed";
}

export function loadPaidPackageForEmailResend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<{ paidAt: number; packageRecord: Doc<"packages"> }, ResendPackageEmailError> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => getPackageForAction(ctx, args.packageId))
		.andThen((packageRecord) => {
			const paidAt = packageRecord.paidAt;

			if (!isPaidPackageStatus(packageRecord.status) || paidAt === undefined) {
				return err({ reason: "PACKAGE_NOT_PAID" as const });
			}

			return ok({ packageRecord, paidAt });
		});
}

export function refreshPackageScheduleLinkForResend(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<PaidPackageResult, ResendPackageEmailError> {
	return refreshPackageScheduleToken(ctx, packageId);
}

export function sendPackagePaidScheduleEmail(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; tokenResult: PaidPackageResult }
): ResultAsync<null, ResendPackageEmailError> {
	return okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).andThen(
		(bookingSettings) =>
			sendAndRecordPackagePaidEmail(
				ctx,
				args.packageId,
				buildPackagePaidEmailContext(
					args.tokenResult,
					bookingSettings.leadTimeMinutes,
					new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
				)
			)
	);
}
