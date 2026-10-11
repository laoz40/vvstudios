import { okAsync } from "neverthrow";

import { exhaustiveCheck } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { BookingClaimOutcome } from "#convex/booking/services/confirmationMutations";

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

export function completeClaimedBookingConfirmation(
	ctx: ActionCtx,
	claim: Extract<BookingClaimOutcome, { outcome: "claimed" }>
) {
	return fromConvexTuple(
		ctx.runAction(internal.googleCalendar.calendar.completeClaimedSession, {
			bookingId: claim.session._id
		})
	).mapErr((error) => ({ kind: "completion_failed" as const, error }));
}

export function checkoutSuccessFromClaimOutcome(ctx: ActionCtx, claim: BookingClaimOutcome) {
	const claimOutcome = claim.outcome;

	switch (claimOutcome) {
		case "already_confirmed":
		case "already_claimed":
			return okAsync<CompleteSessionCheckoutSuccess>({ outcome: claim.outcome });
		case "claimed":
			return completeClaimedBookingConfirmation(ctx, claim);
		default:
			return exhaustiveCheck(claimOutcome);
	}
}
