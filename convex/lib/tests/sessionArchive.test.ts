/**
 * Session auto-archive rules.
 *
 * 1. isSessionEligibleForAutoArchive
 *    Past confirmed or email_failed sessions with deliverables sent and no unpaid invoices qualify.
 *
 * 2. isDeadCheckoutStatus
 *    Cancelled, expired, and abandoned are dead checkout statuses; failed is not.
 */
import { describe, expect, test } from "vitest";
import type { Doc } from "#convex/_generated/dataModel";
import { isDeadCheckoutStatus, isSessionEligibleForAutoArchive } from "#convex/lib/sessionArchive";

const pastStartAt = Date.parse("2020-01-01T00:00:00.000Z");

const now = Date.parse("2025-06-01T00:00:00.000Z");

type SessionAutoArchiveFields = Pick<Doc<"bookings">, "status" | "sessionStartAt" | "editStatus">;

function booking(overrides: Partial<SessionAutoArchiveFields> = {}): SessionAutoArchiveFields {
	return {
		status: "confirmed",
		sessionStartAt: pastStartAt,
		editStatus: "completed",
		...overrides
	};
}

describe("isDeadCheckoutStatus", () => {
	test("treats cancelled, expired, and abandoned as dead checkout statuses", () => {
		expect(isDeadCheckoutStatus("cancelled")).toBe(true);
		expect(isDeadCheckoutStatus("expired")).toBe(true);
		expect(isDeadCheckoutStatus("abandoned")).toBe(true);
	});

	test("does not treat failed or email_failed as dead checkout statuses", () => {
		expect(isDeadCheckoutStatus("failed")).toBe(false);
		expect(isDeadCheckoutStatus("email_failed")).toBe(false);
	});
});

describe("isSessionEligibleForAutoArchive", () => {
	test("accepts a past sent session with no unpaid invoices", () => {
		expect(isSessionEligibleForAutoArchive(booking(), null, now)).toBe(true);
	});

	test("rejects upcoming sessions and unpaid invoice summaries", () => {
		expect(
			isSessionEligibleForAutoArchive(
				booking({ sessionStartAt: Date.parse("2099-01-01T00:00:00.000Z") }),
				null,
				now
			)
		).toBe(false);

		expect(
			isSessionEligibleForAutoArchive(booking(), { paymentStatus: "unpaid", totalAmount: 50 }, now)
		).toBe(false);
	});
});
