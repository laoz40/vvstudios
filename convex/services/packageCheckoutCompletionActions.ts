"use node";

import { api } from "#convex/_generated/api";
import type { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { markPackagePaid, sendPackageCheckoutPaidEmails } from "#convex/lib/packagePayment";
import { okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type CompleteClaimedPackageCheckoutSuccess = { outcome: "completed" };

type CompleteClaimedPackageCheckoutError =
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };

export function completeClaimedPackageCheckoutService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<CompleteClaimedPackageCheckoutSuccess, CompleteClaimedPackageCheckoutError> {
	return markPackagePaid(ctx, args.packageId, Date.now())
		.andThen((paymentResult) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, paymentResult })
			)
		)
		.andThen(({ bookingSettings, paymentResult }) =>
			sendPackageCheckoutPaidEmails(
				ctx,
				args.packageId,
				paymentResult,
				bookingSettings.leadTimeMinutes,
				new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
			)
		)
		.map(() => ({ outcome: "completed" as const }));
}
