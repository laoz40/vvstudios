import { ResultAsync } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { getAdminIdentityResult } from "#convex/lib/auth";
import {
	buildPackageScheduleUrl,
	markPackagePaid,
	sendAndRecordPackageScheduleEmail
} from "#convex/lib/packagePayment";
import { okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type ConfirmPackagePaymentArgs = { multiBookingId: Id<"multiBookingPackages"> };
type ConfirmPackagePaymentResult = ResultAsync<
	null,
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" }
>;

export function confirmPackagePaymentService(
	ctx: ActionCtx,
	args: ConfirmPackagePaymentArgs
): ConfirmPackagePaymentResult {
	return (
		getAdminIdentityResult(ctx)
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
