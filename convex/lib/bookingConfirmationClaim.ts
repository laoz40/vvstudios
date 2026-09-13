import { err, ok, type Result } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc } from "#convex/_generated/dataModel";

export type BookingClaimSession = Pick<
	Doc<"bookings">,
	"status" | "stripeSessionId" | "bookingConfirmationClaimedAt"
>;

export type BookingClaimStatusError =
	| { reason: "BOOKING_INVALID_STATUS"; status: "cancelled" | "abandoned" }
	| { reason: "BOOKING_EXPIRED" }
	| { reason: "BOOKING_FAILED" };

export function validateClaimStripeSession<T extends BookingClaimSession>(
	session: T,
	stripeSessionId: string
) {
	if (session.stripeSessionId && session.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" as const });
	}

	return ok(session);
}

export type BookingClaimStatus<T extends BookingClaimSession = BookingClaimSession> =
	| { kind: "already_confirmed" }
	| { kind: "already_claimed" }
	| { kind: "pending"; session: T };

export function getBookingClaimStatus<T extends BookingClaimSession>(
	session: T
): Result<BookingClaimStatus<T>, BookingClaimStatusError> {
	switch (session.status) {
		case "confirmed":
		case "email_failed":
			return ok({ kind: "already_confirmed" });
		case "cancelled":
		case "abandoned":
			return err({ reason: "BOOKING_INVALID_STATUS", status: session.status });
		case "expired":
			return err({ reason: "BOOKING_EXPIRED" });
		case "failed":
			return err({ reason: "BOOKING_FAILED" });
		case "pending_payment":
			return session.bookingConfirmationClaimedAt
				? ok({ kind: "already_claimed" })
				: ok({ kind: "pending", session });
		default:
			return exhaustiveCheck(session.status);
	}
}
