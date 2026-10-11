import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { BookingClaimOutcome } from "#convex/booking/services/confirmationMutations";

type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	originalPaidAmount?: number;
	stripeEventId: string;
};

export function completeSessionCheckoutServiceOperation(
	ctx: ActionCtx,
	args: ClaimBookingConfirmationArgs
) {
	return fromConvexTuple<Promise<ConvexResult<BookingClaimOutcome, { reason: string }>>>(
		ctx.runMutation(internal.booking.confirmation.claimBookingConfirmation, args)
	);
}
