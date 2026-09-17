"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	buildPackagePaidEmailContext,
	markPackagePaid,
	refreshPackageScheduleToken,
	sendAndRecordPackagePaidEmail
} from "#convex/lib/packagePayment";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

export type { CreatePackageRequestArgs } from "#convex/lib/packageUpdates";

type PackageIdArgs = { packageId: Id<"packages"> };

type AuthError = { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" };

type PackagePaidEmailError =
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" };

export type CreatePackageCheckoutSessionSuccess = {
	packageId: Id<"packages">;
	clientSecret: string;
	stripeSessionId: string;
};

export type CreatePackageCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| { reason: "STRIPE_CHECKOUT_CREATE_FAILED" };

export type ConfirmPackagePaymentError =
	| AuthError
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| PackagePaidEmailError;

export type ResendPackageEmailError =
	| AuthError
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" }
	| PackagePaidEmailError;

function isPaidPackageStatus(status: string) {
	return status === "paid" || status === "schedule_email_failed";
}

export function confirmPackagePaymentService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<null, ConfirmPackagePaymentError> {
	return requirePermissionActions(ctx, "update:payment-status")
		.andThen(() => markPackagePaid(ctx, args.packageId, Date.now()))
		.andThen((paymentResult) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, paymentResult })
			)
		)
		.andThen(({ bookingSettings, paymentResult }) =>
			sendAndRecordPackagePaidEmail(
				ctx,
				args.packageId,
				buildPackagePaidEmailContext(
					paymentResult,
					bookingSettings.leadTimeMinutes,
					new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
				)
			)
		);
}

export function resendPackageEmailService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<null, ResendPackageEmailError> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => getPackageForAction(ctx, args.packageId))
		.andThen((packageRecord) => {
			const paidAt = packageRecord.paidAt;

			if (!isPaidPackageStatus(packageRecord.status) || paidAt === undefined) {
				return err({ reason: "PACKAGE_NOT_PAID" as const });
			}

			return ok({ packageRecord, paidAt });
		})
		.andThen(() => refreshPackageScheduleToken(ctx, args.packageId))
		.andThen((tokenResult) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, tokenResult })
			)
		)
		.andThen(({ bookingSettings, tokenResult }) =>
			sendAndRecordPackagePaidEmail(
				ctx,
				args.packageId,
				buildPackagePaidEmailContext(
					tokenResult,
					bookingSettings.leadTimeMinutes,
					new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
				)
			)
		);
}
