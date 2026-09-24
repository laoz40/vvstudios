/**
 * Deliverables session eligibility guards.
 *
 * 1. requireDeliverablesEligibility
 *    Rejects unconfirmed and future sessions before deliverables work starts.
 */
import { describe, expect, test } from "vitest";
import type { DeliverablesEligibilitySession } from "#convex/lib/editorSessions";
import { requireDeliverablesEligibility } from "#convex/lib/editorSessions";
import { testUserIdentity } from "#convex/lib/tests/testIds";

const pastStartAt = Date.parse("2020-01-01T00:00:00.000Z");

const futureStartAt = Date.parse("2030-01-01T00:00:00.000Z");

function session(
	overrides: Partial<DeliverablesEligibilitySession> = {}
): DeliverablesEligibilitySession {
	return { status: "confirmed", sessionStartAt: pastStartAt, ...overrides };
}

function access(overrides: Partial<DeliverablesEligibilitySession> = {}) {
	return { identity: testUserIdentity(), session: session(overrides) };
}

describe("requireDeliverablesEligibility", () => {
	test("rejects sessions that are not confirmed or email_failed", () => {
		const result = requireDeliverablesEligibility(access({ status: "pending_payment" }));

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "SESSION_NOT_CONFIRMED" });
		}
	});

	test("rejects sessions that have not started yet", () => {
		const result = requireDeliverablesEligibility(access({ sessionStartAt: futureStartAt }));

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "SESSION_NOT_IN_PAST" });
		}
	});
});
