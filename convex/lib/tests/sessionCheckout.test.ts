/**
 * Pending session cleanup when embedded checkout closes without payment.
 *
 * 1. Session mismatch
 *    Closing checkout for a different Stripe session must not abandon the booking.
 *
 * 2. Non-pending booking
 *    Confirmed or cancelled bookings must be left unchanged.
 *
 * 3. Pending abandonment
 *    A pending booking with a matching Stripe session may be abandoned.
 *
 * 4. Missing booking
 *    A missing booking record is treated as not found.
 */
import { describe, expect, test } from "vitest";
import type { Doc } from "#convex/_generated/dataModel";
import { validatePendingSessionDeletion } from "#convex/lib/sessionCheckout";
import { testBookingId } from "#convex/lib/tests/testIds";

function bookingRecord(
	overrides: Partial<Pick<Doc<"bookings">, "status" | "stripeSessionId">> = {}
): Doc<"bookings"> {
	// SAFETY: Unit tests only pass the booking fields read by validatePendingSessionDeletion.
	return {
		_id: testBookingId("booking-1"),
		status: "pending_payment",
		stripeSessionId: "cs-1",
		...overrides
	} as Doc<"bookings">;
}

describe("validatePendingSessionDeletion", () => {
	test("rejects a close request when the Stripe session does not match", () => {
		const result = validatePendingSessionDeletion(bookingRecord(), "cs-other");

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});

	test("does not abandon a booking that is no longer pending payment", () => {
		const confirmed = validatePendingSessionDeletion(
			bookingRecord({ status: "confirmed" }),
			"cs-1"
		);

		const cancelled = validatePendingSessionDeletion(
			bookingRecord({ status: "cancelled" }),
			"cs-1"
		);

		expect(confirmed.isOk()).toBe(true);
		expect(cancelled.isOk()).toBe(true);

		if (confirmed.isOk()) {
			expect(confirmed.value).toEqual({
				kind: "complete",
				value: { outcome: "not_pending", status: "confirmed" }
			});
		}

		if (cancelled.isOk()) {
			expect(cancelled.value).toEqual({
				kind: "complete",
				value: { outcome: "not_pending", status: "cancelled" }
			});
		}
	});

	test("abandons a pending booking when the Stripe session matches", () => {
		const result = validatePendingSessionDeletion(bookingRecord(), "cs-1");

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "abandon" });
		}
	});

	test("treats a missing booking as not found", () => {
		const result = validatePendingSessionDeletion(null, "cs-1");

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "complete", value: { outcome: "not_found" } });
		}
	});
});
