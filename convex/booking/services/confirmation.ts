import { completeSessionCheckoutServiceOperation } from "#convex/booking/lib/confirmationIo";

import type { ActionCtx } from "#convex/_generated/server";

import type { BookingClaimOutcome } from "#convex/booking/services/confirmationMutations";
import { checkoutSuccessFromClaimOutcome } from "#convex/booking/lib/confirmationSteps";

export type CompleteClaimedSessionSuccess = {
	outcome:
		| "already_completed"
		| "completed"
		| "booking_time_unavailable"
		| "booking_invalid_input"
		| "google_calendar_create_failed"
		| "reservation_lost";
};

type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	originalPaidAmount?: number;
	stripeEventId: string;
};

export function completeSessionCheckoutService(ctx: ActionCtx, args: ClaimBookingConfirmationArgs) {
	return completeSessionCheckoutServiceOperation(ctx, args)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim: BookingClaimOutcome) => checkoutSuccessFromClaimOutcome(ctx, claim));
}
