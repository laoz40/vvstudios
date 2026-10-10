import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

function isConfirmedBookingStatus(status: string) {
	return status === "confirmed" || status === "email_failed";
}

export function validateConfirmedSessionForReceiptResend(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "BOOKING_NOT_CONFIRMED" }> {
	if (!isConfirmedBookingStatus(session.status)) {
		return err({ reason: "BOOKING_NOT_CONFIRMED" });
	}

	return ok(session);
}
