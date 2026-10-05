import { ok } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { exhaustiveCheck } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import type { BookingClaimOutcome } from "#convex/services/booking/bookingConfirmationMutations";

export type CompleteClaimedSessionSuccess = {
	outcome:
		| "already_completed"
		| "completed"
		| "booking_time_unavailable"
		| "booking_invalid_input"
		| "google_calendar_create_failed"
		| "reservation_lost";
};

type CompleteSessionCheckoutSuccess =
	| CompleteClaimedSessionSuccess
	| { outcome: "already_confirmed" | "already_claimed" };

type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	stripeEventId: string;
};

export function completeSessionCheckoutService(ctx: ActionCtx, args: ClaimBookingConfirmationArgs) {
	return fromConvexTuple<Promise<ConvexResult<BookingClaimOutcome, { reason: string }>>>(
		ctx.runMutation(internal.bookingConfirmation.claimBookingConfirmation, args)
	)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim) => {
			const claimOutcome = claim.outcome;

			switch (claimOutcome) {
				case "already_confirmed":
				case "already_claimed":
					return ok<CompleteSessionCheckoutSuccess>({ outcome: claim.outcome });
				case "claimed":
					return fromConvexTuple(
						ctx.runAction(internal.googleCalendar.completeClaimedSession, {
							bookingId: claim.session._id
						})
					).mapErr((error) => ({ kind: "completion_failed" as const, error }));
				default:
					return exhaustiveCheck(claimOutcome);
			}
		});
}
