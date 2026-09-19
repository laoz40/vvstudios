"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	checkPackageSubmitRateLimit,
	emailDomainCanReceiveMail
} from "#convex/lib/bookingSubmission";
import {
	buildPackageScheduleUrl,
	createPendingPackage,
	markPackagePaid,
	refreshPackageScheduleToken,
	sendAndRecordPackageScheduleEmail,
	sendPackageInvoice
} from "#convex/lib/packagePayment";
import type { PackageInvoiceEmailAttemptError } from "#convex/lib/bookingInvoiceArtifacts";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { parsePackageRequest, type CreatePackageRequestArgs } from "#convex/lib/packageUpdates";

export type { CreatePackageRequestArgs } from "#convex/lib/packageUpdates";

type PackageIdArgs = { packageId: Id<"packages"> };

type AuthError = { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" };

type PackageScheduleEmailError =
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };

export type CreatePackageRequestSuccess = {
	packageId: Id<"packages">;
	invoiceEmailStatus: "sent" | "failed";
};

export type CreatePackageRequestError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| PackageInvoiceEmailAttemptError;

export type ResendPackageInvoiceEmailSuccess = { sent: true };

export type ResendPackageInvoiceEmailError =
	| AuthError
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_UNPAID" }
	| { reason: "PACKAGE_INVOICE_EMAIL_FAILED" }
	| PackageInvoiceEmailAttemptError;

export type ConfirmPackagePaymentError =
	| AuthError
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| PackageScheduleEmailError;

export type RetryPackageSchedulingEmailError =
	| AuthError
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" }
	| { reason: "PACKAGE_SCHEDULE_TOKEN_UPDATE_FAILED" }
	| PackageScheduleEmailError;

export function createPackageRequestService(
	ctx: ActionCtx,
	args: CreatePackageRequestArgs
): ResultAsync<CreatePackageRequestSuccess, CreatePackageRequestError> {
	return (
		parsePackageRequest(args)
			.andThen((packageRequest) =>
				checkPackageSubmitRateLimit(ctx, packageRequest.email).map(() => packageRequest)
			)
			// Validate deliverability before creating a package that cannot receive its invoice.
			.andThen((validRequest) =>
				okOrThrow(emailDomainCanReceiveMail(validRequest.email)).andThen((isDeliverable) =>
					isDeliverable
						? ok(validRequest)
						: err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" as const })
				)
			)
			// Persist the normalized commercial snapshot before attempting external delivery.
			.andThen((validRequest) => createPendingPackage(ctx, validRequest))
			// Invoice delivery failure is recorded but does not discard the created request.
			.andThen((packageFromDb) =>
				sendPackageInvoice(ctx, packageFromDb).map((invoiceEmailStatus) => ({
					packageId: packageFromDb._id,
					invoiceEmailStatus
				}))
			)
	);
}

export function resendPackageInvoiceEmailService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<ResendPackageInvoiceEmailSuccess, ResendPackageInvoiceEmailError> {
	return requirePermissionActions(ctx, "send:invoice-emails")
		.andThen(() => getPackageForAction(ctx, args.packageId))
		.andThen((packageFromDb) => {
			if (
				packageFromDb.status !== "pending_payment" &&
				packageFromDb.status !== "invoice_email_failed"
			) {
				return err({ reason: "PACKAGE_NOT_UNPAID" as const });
			}

			return ok(packageFromDb);
		})
		.andThen((packageFromDb) => sendPackageInvoice(ctx, packageFromDb))
		.andThen((invoiceEmailStatus) =>
			invoiceEmailStatus === "sent"
				? ok({ sent: true as const })
				: err({ reason: "PACKAGE_INVOICE_EMAIL_FAILED" as const })
		);
}

export function confirmPackagePaymentService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<null, ConfirmPackagePaymentError> {
	return (
		requirePermissionActions(ctx, "update:payment-status")
			// Mark the package paid and create the token and expiry used by its scheduling link.
			.andThen(() => markPackagePaid(ctx, args.packageId, Date.now()))
			// Load lead time so the email explains how far ahead each session must be scheduled.
			.andThen((paymentResult) =>
				okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(bookingSettings) => ({ bookingSettings, paymentResult })
				)
			)
			// Send the scheduling link and save its delivery status for admin retries.
			.andThen(({ bookingSettings, paymentResult }) =>
				sendAndRecordPackageScheduleEmail(ctx, args.packageId, {
					addons: paymentResult.packageRecord.addons,
					clipsPackageQuantity: paymentResult.packageRecord.clipsPackageQuantity,
					completeEditQuantity: paymentResult.packageRecord.completeEditQuantity,
					duration: paymentResult.packageRecord.duration,
					email: paymentResult.packageRecord.email,
					essentialEditQuantity: paymentResult.packageRecord.essentialEditQuantity,
					handcraftedClipsQuantity: paymentResult.packageRecord.handcraftedClipsQuantity,
					expiresAt: paymentResult.expiresAt,
					leadTimeMinutes: bookingSettings.leadTimeMinutes,
					name: paymentResult.packageRecord.name,
					packageSize: paymentResult.packageRecord.packageSize,
					bookedAt: paymentResult.paidAt,
					scheduleUrl: buildPackageScheduleUrl(
						new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin,
						paymentResult.token
					)
				})
			)
	);
}

export function retryPackageSchedulingEmailService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<null, RetryPackageSchedulingEmailError> {
	return (
		requirePermissionActions(ctx, "send:invoice-emails")
			// Rotate the failed package's scheduling token before exposing a fresh link.
			.andThen(() => refreshPackageScheduleToken(ctx, args.packageId))
			// Load lead time so the replacement email contains current scheduling guidance.
			.andThen((tokenResult) =>
				okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(bookingSettings) => ({ bookingSettings, tokenResult })
				)
			)
			// Send the replacement scheduling link and persist the resulting status.
			.andThen(({ bookingSettings, tokenResult }) =>
				sendAndRecordPackageScheduleEmail(ctx, args.packageId, {
					addons: tokenResult.packageRecord.addons,
					clipsPackageQuantity: tokenResult.packageRecord.clipsPackageQuantity,
					completeEditQuantity: tokenResult.packageRecord.completeEditQuantity,
					duration: tokenResult.packageRecord.duration,
					email: tokenResult.packageRecord.email,
					essentialEditQuantity: tokenResult.packageRecord.essentialEditQuantity,
					handcraftedClipsQuantity: tokenResult.packageRecord.handcraftedClipsQuantity,
					expiresAt: tokenResult.expiresAt,
					leadTimeMinutes: bookingSettings.leadTimeMinutes,
					name: tokenResult.packageRecord.name,
					packageSize: tokenResult.packageRecord.packageSize,
					bookedAt: tokenResult.paidAt,
					scheduleUrl: buildPackageScheduleUrl(
						new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin,
						tokenResult.token
					)
				})
			)
	);
}
