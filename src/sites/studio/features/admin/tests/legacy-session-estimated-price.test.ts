/**
 * Legacy session estimates.
 *
 * 1. Uses the current full booking price for a confirmed legacy session, including legacy duration labels.
 * 2. Includes quantities for selected editing add-ons in the estimated price.
 * 3. Preserves recorded payment amounts, including zero, and estimates older Stripe-linked bookings without an amount.
 * 4. Suppresses estimates for non-confirmed sessions and invalid durations while estimating valid sessions.
 */
import { describe, expect, test } from "vitest";
import { getLegacySessionEstimatedPrice } from "#studio/features/admin/lib/admin-sessions";

type LegacySessionEstimateInput = Parameters<typeof getLegacySessionEstimatedPrice>[0] & {
	stripeSessionId?: string;
	stripePaymentIntentId?: string;
};

function createSession(
	overrides: Partial<LegacySessionEstimateInput> = {}
): LegacySessionEstimateInput {
	return { status: "confirmed", duration: "1h", addons: [], ...overrides };
}

describe("getLegacySessionEstimatedPrice", () => {
	test("estimates the full price of a legacy confirmed session", () => {
		expect(
			getLegacySessionEstimatedPrice(
				createSession({ duration: "2 hours", addons: ["Teleprompter"] })
			)
		).toBe(328);
		expect(getLegacySessionEstimatedPrice(createSession({ status: "email_failed" }))).toBe(200);
	});

	test("includes the selected quantity of editing add-ons", () => {
		expect(
			getLegacySessionEstimatedPrice(
				createSession({ duration: "1h", addons: ["Essential Edit"], essentialEditQuantity: "2" })
			)
		).toBe(400);
	});

	test("does not estimate sessions with a recorded payment amount, including zero", () => {
		const legacySession = createSession({ duration: "2h", addons: ["Teleprompter"] });

		expect(getLegacySessionEstimatedPrice(legacySession)).toBe(328);
		expect(getLegacySessionEstimatedPrice({ ...legacySession, originalPaidAmount: 0 })).toBeNull();
		expect(
			getLegacySessionEstimatedPrice({ ...legacySession, originalPaidAmount: 100 })
		).toBeNull();
	});

	test("estimates legacy Stripe bookings when the paid amount is missing", () => {
		const legacySession = createSession({ duration: "2h", addons: ["Teleprompter"] });

		expect(getLegacySessionEstimatedPrice(legacySession)).toBe(328);
		expect(
			getLegacySessionEstimatedPrice(createSession({ ...legacySession, stripeSessionId: "cs_123" }))
		).toBe(328);
		expect(
			getLegacySessionEstimatedPrice(
				createSession({ ...legacySession, stripePaymentIntentId: "pi_123" })
			)
		).toBe(328);
	});

	test("estimates confirmed sessions and suppresses pending, cancelled, and invalid-duration rows", () => {
		const validSession = createSession({ duration: "2h", addons: ["Teleprompter"] });

		expect(getLegacySessionEstimatedPrice(validSession)).toBe(328);
		expect(
			getLegacySessionEstimatedPrice({ ...validSession, status: "pending_payment" })
		).toBeNull();
		expect(getLegacySessionEstimatedPrice({ ...validSession, status: "cancelled" })).toBeNull();
		expect(getLegacySessionEstimatedPrice({ ...validSession, duration: "4h" })).toBeNull();
	});
});
