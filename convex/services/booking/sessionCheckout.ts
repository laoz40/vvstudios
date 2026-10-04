import { ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { archiveDeadCheckoutBooking } from "#convex/lib/sessions/sessionArchive";
import {
	validatePendingSessionDeletion,
	validateSessionExpiry,
	type DeletePendingSessionSuccess
} from "#convex/lib/sessions/sessionCheckout";

export function markSessionExpiredByStripeSessionIdService(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	return (
		okOrThrow(
			ctx.db
				.query("bookings")
				.withIndex("by_stripeSessionId", (indexQuery) =>
					indexQuery.eq("stripeSessionId", args.stripeSessionId)
				)
				.unique()
		)
			// Confirm that the booking can transition to expired.
			.andThen(validateSessionExpiry)
			// Preserve idempotency or apply the expiry transition.
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<{ alreadyExpired: boolean }>({ alreadyExpired: decision.alreadyExpired });
				}

				return archiveDeadCheckoutBooking(ctx, decision.bookingId, { status: "expired" }).map(
					() => ({ alreadyExpired: false })
				);
			})
	);
}

export function deletePendingSessionService(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"]; stripeSessionId: string }
) {
	return (
		okOrThrow(ctx.db.get("bookings", args.bookingId))
			// Verify ownership and whether the pending booking still needs abandonment.
			.andThen((booking) => validatePendingSessionDeletion(booking, args.stripeSessionId))
			// Return idempotent outcomes unchanged or abandon the pending booking.
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<DeletePendingSessionSuccess>(decision.value);
				}

				return archiveDeadCheckoutBooking(ctx, args.bookingId, { status: "abandoned" }).map(
					(): DeletePendingSessionSuccess => ({ outcome: "abandoned" })
				);
			})
	);
}
