/**
 * Package payment claim guards before Stripe checkout completion runs.
 *
 * 1. validatePackageClaimStripeSession
 *    Rejects webhook replay for a different Stripe checkout session.
 *
 * 2. getPackageCheckoutClaimStatus
 *    Maps idempotent replays and invalid package states to claim outcomes.
 */
import { describe, expect, test } from "vitest";
import type { PackageCheckoutClaimPackage } from "#convex/lib/packageCheckoutClaim";
import {
	getPackageCheckoutClaimStatus,
	validatePackageClaimStripeSession
} from "#convex/lib/packageCheckoutClaim";

const now = Date.parse("2030-01-01T00:00:00.000Z");

function packageRecord(
	overrides: Partial<PackageCheckoutClaimPackage> = {}
): PackageCheckoutClaimPackage {
	return { status: "pending_payment", stripeSessionId: "cs-1", ...overrides };
}

describe("validatePackageClaimStripeSession", () => {
	test("rejects a claim when the Stripe session does not match", () => {
		const result = validatePackageClaimStripeSession(packageRecord(), "cs-other");

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});
});

describe("getPackageCheckoutClaimStatus", () => {
	test("returns already_claimed when payment was already claimed", () => {
		const result = getPackageCheckoutClaimStatus(
			packageRecord({ status: "pending_payment", packageCheckoutClaimedAt: now })
		);

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "already_claimed" });
		}
	});

	test("rejects abandoned, expired, and invoice email failed packages", () => {
		const abandoned = getPackageCheckoutClaimStatus(packageRecord({ status: "abandoned" }));
		const expired = getPackageCheckoutClaimStatus(packageRecord({ status: "expired" }));
		const invoiceEmailFailed = getPackageCheckoutClaimStatus(
			packageRecord({ status: "invoice_email_failed" })
		);

		expect(abandoned.isErr()).toBe(true);
		expect(expired.isErr()).toBe(true);
		expect(invoiceEmailFailed.isErr()).toBe(true);

		if (abandoned.isErr()) {
			expect(abandoned.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});
});
