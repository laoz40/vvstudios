import { okAsync, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { markPackagePaid, sendPackageCheckoutPaidEmails } from "#convex/lib/packagePayment";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import type { PackageCheckoutClaim } from "#convex/services/packageCheckout";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type CompletePackageCheckoutSuccess = { outcome: "already_completed" | "completed" };

type CompletePackageCheckoutFailure =
	| { kind: "claim_failed"; error: { reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH" } }
	| {
			kind: "completion_failed";
			error:
				| { reason: "PACKAGE_ALREADY_PAID" }
				| { reason: "PACKAGE_NOT_FOUND" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };
	  };

function completeClaimedPackageCheckout(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<CompletePackageCheckoutSuccess, CompletePackageCheckoutFailure> {
	return markPackagePaid(ctx, packageId, Date.now())
		.andThen((paymentResult) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, paymentResult })
			)
		)
		.andThen(({ bookingSettings, paymentResult }) =>
			sendPackageCheckoutPaidEmails(
				ctx,
				packageId,
				paymentResult,
				bookingSettings.leadTimeMinutes,
				new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
			)
		)
		.map(() => ({ outcome: "completed" as const }))
		.mapErr((error) => ({ kind: "completion_failed" as const, error }));
}

export function completePackageCheckoutService(
	ctx: ActionCtx,
	args: { packageId: string; stripeSessionId: string; stripePaymentIntentId?: string }
): ResultAsync<CompletePackageCheckoutSuccess, CompletePackageCheckoutFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.packageCheckout.claimPackageCheckoutPayment, args)
	)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim: PackageCheckoutClaim) => {
			if (claim.outcome === "already_completed") {
				return okAsync({ outcome: "already_completed" as const });
			}

			return completeClaimedPackageCheckout(ctx, claim.packageId);
		});
}
