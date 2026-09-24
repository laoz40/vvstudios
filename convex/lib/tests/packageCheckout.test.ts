/**
 * Pending package cleanup when embedded checkout closes without payment.
 *
 * 1. Session mismatch
 *    Closing checkout for a different Stripe session must not abandon the package.
 *
 * 2. Non-pending package
 *    Paid or expired packages must be left unchanged.
 *
 * 3. Pending abandonment
 *    A pending package with a matching Stripe session may be abandoned.
 */
import { describe, expect, test } from "vitest";
import type { Doc } from "#convex/_generated/dataModel";
import { validatePendingPackageAbandonment } from "#convex/lib/packageCheckout";
import { testPackageId } from "#convex/lib/tests/testIds";

function packageRecord(
	overrides: Partial<Pick<Doc<"packages">, "status" | "stripeSessionId">> = {}
): Doc<"packages"> {
	// SAFETY: Unit tests only pass the package fields read by validatePendingPackageAbandonment.
	return {
		_id: testPackageId("package-1"),
		status: "pending_payment",
		stripeSessionId: "cs-1",
		...overrides
	} as Doc<"packages">;
}

describe("validatePendingPackageAbandonment", () => {
	test("rejects a close request when the Stripe session does not match", () => {
		const result = validatePendingPackageAbandonment(packageRecord(), "cs-other");

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "STRIPE_SESSION_MISMATCH" });
		}
	});

	test("does not abandon a package that is no longer pending payment", () => {
		const paid = validatePendingPackageAbandonment(packageRecord({ status: "paid" }), "cs-1");
		const expired = validatePendingPackageAbandonment(packageRecord({ status: "expired" }), "cs-1");

		expect(paid.isOk()).toBe(true);
		expect(expired.isOk()).toBe(true);

		if (paid.isOk()) {
			expect(paid.value).toEqual({
				kind: "complete",
				value: { outcome: "not_pending", status: "paid" }
			});
		}

		if (expired.isOk()) {
			expect(expired.value).toEqual({
				kind: "complete",
				value: { outcome: "not_pending", status: "expired" }
			});
		}
	});

	test("abandons a pending package when the Stripe session matches", () => {
		const result = validatePendingPackageAbandonment(packageRecord(), "cs-1");

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toEqual({ kind: "abandon" });
		}
	});
});
