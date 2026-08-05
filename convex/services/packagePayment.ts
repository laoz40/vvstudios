"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { getAdminIdentity } from "#convex/lib/auth";
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

type PackageIdArgs = { multiBookingId: Id<"multiBookingPackages"> };
type AuthError = { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" };
type PackageScheduleEmailError =
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };
export type CreatePackageRequestSuccess = {
	multiBookingId: Id<"multiBookingPackages">;
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
					multiBookingId: packageFromDb._id,
					invoiceEmailStatus
				}))
			)
	);
}

export function resendPackageInvoiceEmailService(
	ctx: ActionCtx,
	args: PackageIdArgs
): ResultAsync<ResendPackageInvoiceEmailSuccess, ResendPackageInvoiceEmailError> {
	return getAdminIdentity(ctx)
		.andThen(() => getPackageForAction(ctx, args.multiBookingId))
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
		getAdminIdentity(ctx)
			// Mark the package paid and create the token and expiry used by its scheduling link.
			.andThen(() => markPackagePaid(ctx, args.multiBookingId, Date.now()))
			// Load lead time so the email explains how far ahead each session must be scheduled.
			.andThen((paymentResult) =>
				okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(bookingSettings) => ({ bookingSettings, paymentResult })
				)
			)
			// Send the scheduling link and save its delivery status for admin retries.
			.andThen(({ bookingSettings, paymentResult }) =>
				sendAndRecordPackageScheduleEmail(ctx, args.multiBookingId, {
					addons: paymentResult.multiBooking.addons,
					clipsPackageQuantity: paymentResult.multiBooking.clipsPackageQuantity,
					duration: paymentResult.multiBooking.duration,
					email: paymentResult.multiBooking.email,
					essentialEditQuantity: paymentResult.multiBooking.essentialEditQuantity,
					expiresAt: paymentResult.expiresAt,
					leadTimeMinutes: bookingSettings.leadTimeMinutes,
					name: paymentResult.multiBooking.name,
					packageSize: paymentResult.multiBooking.packageSize,
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
		getAdminIdentity(ctx)
			// Rotate the failed package's scheduling token before exposing a fresh link.
			.andThen(() => refreshPackageScheduleToken(ctx, args.multiBookingId))
			// Load lead time so the replacement email contains current scheduling guidance.
			.andThen((tokenResult) =>
				okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(bookingSettings) => ({ bookingSettings, tokenResult })
				)
			)
			// Send the replacement scheduling link and persist the resulting status.
			.andThen(({ bookingSettings, tokenResult }) =>
				sendAndRecordPackageScheduleEmail(ctx, args.multiBookingId, {
					addons: tokenResult.multiBooking.addons,
					clipsPackageQuantity: tokenResult.multiBooking.clipsPackageQuantity,
					duration: tokenResult.multiBooking.duration,
					email: tokenResult.multiBooking.email,
					essentialEditQuantity: tokenResult.multiBooking.essentialEditQuantity,
					expiresAt: tokenResult.expiresAt,
					leadTimeMinutes: bookingSettings.leadTimeMinutes,
					name: tokenResult.multiBooking.name,
					packageSize: tokenResult.multiBooking.packageSize,
					bookedAt: tokenResult.paidAt,
					scheduleUrl: buildPackageScheduleUrl(
						new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin,
						tokenResult.token
					)
				})
			)
	);
}
