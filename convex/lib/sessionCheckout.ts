import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

export type ExpireSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_INVALID_STATUS"; status: Doc<"bookings">["status"] };
export type ExpireSessionDecision =
	| { kind: "complete"; alreadyExpired: true }
	| { kind: "expire"; bookingId: Doc<"bookings">["_id"] };

export type DeletePendingSessionSuccess =
	| { outcome: "not_found" }
	| { outcome: "not_pending"; status: Doc<"bookings">["status"] }
	| { outcome: "abandoned" };
export type DeletePendingSessionDecision =
	| { kind: "complete"; value: DeletePendingSessionSuccess }
	| { kind: "abandon" };

export function validateSessionExpiry(
	booking: Doc<"bookings"> | null
): Result<ExpireSessionDecision, ExpireSessionError> {
	if (!booking) return err({ reason: "BOOKING_NOT_FOUND" });
	if (booking.status === "expired") {
		return ok({ kind: "complete", alreadyExpired: true });
	}
	if (booking.status !== "pending_payment") {
		return err({ reason: "BOOKING_INVALID_STATUS", status: booking.status });
	}
	return ok({ kind: "expire", bookingId: booking._id });
}

export function validatePendingSessionDeletion(
	booking: Doc<"bookings"> | null,
	stripeSessionId: string
): Result<DeletePendingSessionDecision, { reason: "STRIPE_SESSION_MISMATCH" }> {
	if (!booking) return ok({ kind: "complete", value: { outcome: "not_found" } });
	if (booking.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" });
	}
	if (booking.status !== "pending_payment") {
		return ok({ kind: "complete", value: { outcome: "not_pending", status: booking.status } });
	}
	return ok({ kind: "abandon" });
}
