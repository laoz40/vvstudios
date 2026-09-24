/**
 * Package auto-archive rules.
 *
 * 1. isPackageEligibleForAutoArchive
 *    Paid packages with a closed window, resolved adjustment, and no unpaid custom invoices qualify.
 *
 * 2. isDeadPackageStatus
 *    Expired and abandoned are dead package statuses; schedule_email_failed is not.
 */
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { isDeadPackageStatus, isPackageEligibleForAutoArchive } from "#convex/lib/packageArchive";

const now = Date.parse("2030-06-01T00:00:00.000Z");

const pastSessionStartAt = Date.parse("2030-01-01T10:00:00.000Z");

type PackageAutoArchiveFields = Pick<Doc<"packages">, "status" | "expiresAt" | "packageSize">;

function packageRecord(
	overrides: Partial<PackageAutoArchiveFields> = {}
): PackageAutoArchiveFields {
	return { status: "paid", expiresAt: pastSessionStartAt, packageSize: 4, ...overrides };
}

const completedSession = {
	// SAFETY: unit test fixture id; evaluatePackageAdjustment only reads duration and session times.
	_id: "10000;bookings" as Id<"bookings">,
	duration: "1h" as const,
	sessionStartAt: pastSessionStartAt,
	addons: []
};

describe("isDeadPackageStatus", () => {
	test("treats expired and abandoned as dead package statuses", () => {
		expect(isDeadPackageStatus("expired")).toBe(true);
		expect(isDeadPackageStatus("abandoned")).toBe(true);
	});

	test("does not treat schedule_email_failed as a dead package status", () => {
		expect(isDeadPackageStatus("schedule_email_failed")).toBe(false);
	});
});

describe("isPackageEligibleForAutoArchive", () => {
	test("accepts an expired paid package with a no-charge adjustment", () => {
		expect(
			isPackageEligibleForAutoArchive(
				packageRecord({ expiresAt: pastSessionStartAt }),
				[completedSession],
				{ outcome: "no_charge" },
				null,
				now
			)
		).toBe(true);
	});

	test("rejects packages before expiry with unresolved adjustments", () => {
		expect(
			isPackageEligibleForAutoArchive(
				packageRecord({ expiresAt: Date.parse("2099-01-01T00:00:00.000Z") }),
				[completedSession],
				null,
				null,
				now
			)
		).toBe(false);

		expect(
			isPackageEligibleForAutoArchive(
				packageRecord(),
				[completedSession],
				{ outcome: "invoice_required", paymentStatus: "unpaid" },
				null,
				now
			)
		).toBe(false);
	});
});
