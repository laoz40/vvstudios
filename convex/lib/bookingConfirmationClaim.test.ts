/**
 * Booking payment claim guards before Stripe completion runs.
 *
 * 1. validateClaimStripeSession
 *    Accepts matching checkout sessions and rejects webhook replay for a different session.
 *
 * 2. getBookingClaimStatus
 *    Maps booking status and existing claims to claim, replay, or error outcomes.
 */
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
	getBookingClaimStatus,
	validateClaimStripeSession
} from "#convex/lib/bookingConfirmationClaim";

const now = Date.parse("2030-01-01T00:00:00.000Z");

function booking(overrides: Partial<Doc<"bookings">> = {}): Doc<"bookings"> {
	// SAFETY: Unit test fixture; claim helpers only read status, stripeSessionId, and claim timestamps.
	return {
		_id: "booking-1" as Id<"bookings">,
		status: "pending_payment",
		stripeSessionId: "cs-1",
		...overrides
	} as Doc<"bookings">;
}

describe("validateClaimStripeSession", () => {
	test("accepts a claim when the booking has no stored Stripe session yet", () => {
		const session = booking({ stripeSessionId: undefined });

		expect(validateClaimStripeSession(session, "cs-1").isOk()).toBe(true);
	});

	test("accepts a claim when the Stripe session matches", () => {
		expect(validateClaimStripeSession(booking(), "cs-1").isOk()).toBe(true);
	});

	test("rejects a claim when the Stripe session does not match", () => {
		const result = validateClaimStripeSession(booking(), "cs-other");

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});
});

describe("getBookingClaimStatus", () => {
	test("returns already_confirmed for confirmed bookings", () => {
		const result = getBookingClaimStatus(booking({ status: "confirmed" }));

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "already_confirmed" });
		}
	});

	test("returns already_confirmed for email_failed bookings", () => {
		const result = getBookingClaimStatus(booking({ status: "email_failed" }));

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "already_confirmed" });
		}
	});

	test("returns pending for an unclaimed pending_payment booking", () => {
		const session = booking({ status: "pending_payment" });
		const result = getBookingClaimStatus(session);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "pending", session });
		}
	});

	test("returns already_claimed when payment was already claimed", () => {
		const result = getBookingClaimStatus(
			booking({ status: "pending_payment", bookingConfirmationClaimedAt: now })
		);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "already_claimed" });
		}
	});

	test("rejects cancelled and abandoned bookings", () => {
		const cancelled = getBookingClaimStatus(booking({ status: "cancelled" }));
		const abandoned = getBookingClaimStatus(booking({ status: "abandoned" }));

		expect(cancelled.isErr()).toBe(true);
		expect(abandoned.isErr()).toBe(true);
		if (cancelled.isErr()) {
			expect(cancelled.error).toEqual({ reason: "BOOKING_INVALID_STATUS", status: "cancelled" });
		}
		if (abandoned.isErr()) {
			expect(abandoned.error).toEqual({ reason: "BOOKING_INVALID_STATUS", status: "abandoned" });
		}
	});

	test("rejects expired and failed bookings", () => {
		const expired = getBookingClaimStatus(booking({ status: "expired" }));
		const failed = getBookingClaimStatus(booking({ status: "failed" }));

		expect(expired.isErr()).toBe(true);
		expect(failed.isErr()).toBe(true);
		if (expired.isErr()) {
			expect(expired.error).toEqual({ reason: "BOOKING_EXPIRED" });
		}
		if (failed.isErr()) {
			expect(failed.error).toEqual({ reason: "BOOKING_FAILED" });
		}
	});
});
