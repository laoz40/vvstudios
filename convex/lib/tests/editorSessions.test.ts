/**
 * Deliverables session eligibility guards.
 *
 * 1. requireDeliverablesEligibility
 *    Rejects unconfirmed, archived, and future sessions before deliverables work starts.
 */
import { describe, expect, test } from "vitest";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { requireDeliverablesEligibility } from "#convex/lib/editorSessions";

const pastStartAt = Date.parse("2020-01-01T00:00:00.000Z");

const futureStartAt = Date.parse("2030-01-01T00:00:00.000Z");

function session(overrides: Partial<Doc<"bookings">> = {}): Doc<"bookings"> {
	// SAFETY: Unit test fixture; eligibility helper only reads status, hiddenAt, and sessionStartAt.
	return {
		_id: "booking-1" as Id<"bookings">,
		status: "confirmed",
		sessionStartAt: pastStartAt,
		...overrides
	} as Doc<"bookings">;
}

function access(overrides: Partial<Doc<"bookings">> = {}) {
	return { identity: { tokenIdentifier: "editor-1" } as UserIdentity, session: session(overrides) };
}

describe("requireDeliverablesEligibility", () => {
	test("accepts confirmed past sessions", () => {
		const result = requireDeliverablesEligibility(access());

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value._id).toBe("booking-1");
		}
	});

	test("accepts email_failed past sessions", () => {
		const result = requireDeliverablesEligibility(access({ status: "email_failed" }));

		expect(result.isOk()).toBe(true);
	});

	test("rejects sessions that are not confirmed or email_failed", () => {
		const result = requireDeliverablesEligibility(access({ status: "pending_payment" }));

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "SESSION_NOT_CONFIRMED" });
		}
	});

	test("rejects archived sessions", () => {
		const result = requireDeliverablesEligibility(access({ hiddenAt: Date.now() }));

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "SESSION_ARCHIVED" });
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
