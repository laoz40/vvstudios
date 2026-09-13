/**
 * Booking payment claim guards before Stripe completion runs.
 *
 * 1. validateClaimStripeSession
 *    Rejects webhook replay for a different Stripe checkout session.
 *
 * 2. getBookingClaimStatus
 *    Maps idempotent replays and invalid booking states to claim errors.
 */
import { describe, expect, test } from "vitest";
import type { BookingClaimSession } from "#convex/lib/bookingConfirmationClaim";
import {
	getBookingClaimStatus,
	validateClaimStripeSession
} from "#convex/lib/bookingConfirmationClaim";

const now = Date.parse("2030-01-01T00:00:00.000Z");

function booking(overrides: Partial<BookingClaimSession> = {}): BookingClaimSession {
	return { status: "pending_payment", stripeSessionId: "cs-1", ...overrides };
}

describe("validateClaimStripeSession", () => {
	test("rejects a claim when the Stripe session does not match", () => {
		const result = validateClaimStripeSession(booking(), "cs-other");

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});
});

describe("getBookingClaimStatus", () => {
	test("returns already_claimed when payment was already claimed", () => {
		const result = getBookingClaimStatus(
			booking({ status: "pending_payment", bookingConfirmationClaimedAt: now })
		);

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "already_claimed" });
		}
	});

	test("rejects cancelled, abandoned, expired, and failed bookings", () => {
		const cancelled = getBookingClaimStatus(booking({ status: "cancelled" }));
		const abandoned = getBookingClaimStatus(booking({ status: "abandoned" }));
		const expired = getBookingClaimStatus(booking({ status: "expired" }));
		const failed = getBookingClaimStatus(booking({ status: "failed" }));

		expect(cancelled.isErr()).toBe(true);
		expect(abandoned.isErr()).toBe(true);
		expect(expired.isErr()).toBe(true);
		expect(failed.isErr()).toBe(true);

		if (cancelled.isErr()) {
			expect(cancelled.error).toEqual({ reason: "BOOKING_INVALID_STATUS", status: "cancelled" });
		}

		if (abandoned.isErr()) {
			expect(abandoned.error).toEqual({ reason: "BOOKING_INVALID_STATUS", status: "abandoned" });
		}

		if (expired.isErr()) {
			expect(expired.error).toEqual({ reason: "BOOKING_EXPIRED" });
		}

		if (failed.isErr()) {
			expect(failed.error).toEqual({ reason: "BOOKING_FAILED" });
		}
	});
});
