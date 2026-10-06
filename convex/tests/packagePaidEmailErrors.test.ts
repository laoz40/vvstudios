/**
 * Package receipt resend reports the failure that it records.
 *
 * 1. Email delivery failures
 *    Request and response failures return their original domain reason to the caller.
 *
 * 2. Failure recording
 *    Resend persists the same reason and marks the paid package's email as failed.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";
import { packageDocument } from "#convex/tests/insertDocumentDefaults";

afterEach(() => vi.restoreAllMocks());

describe("package receipt email errors", () => {
	test.each(["EMAIL_REQUEST_FAILED", "EMAIL_RESPONSE_FAILED"] as const)(
		"returns and records %s without replacing the reason",
		async (reason) => {
			const t = createConvexTest();

			const staff = t.withIdentity({
				email: "admin@vvstudios.com.au",
				publicMetadata: { role: "admin" }
			});

			const packageId = await t.run((ctx) =>
				ctx.db.insert(
					"packages",
					packageDocument({
						name: "Package customer",
						phone: "0400000000",
						accountName: "Package account",
						email: "customer@example.com",
						duration: "1h",
						addons: [],
						packageSize: 4,
						singleSessionAmount: 100,
						packageSubtotalAmount: 400,
						discountPercent: 10,
						discountAmount: 40,
						totalDueAmount: 360,
						status: "paid",
						archived: false,
						createdAt: Date.parse("2030-01-01T00:00:00.000Z"),
						paidAt: Date.parse("2030-01-01T00:00:00.000Z"),
						expiresAt: Date.parse("2030-04-01T00:00:00.000Z"),
						receiptEmailStatus: "pending"
					})
				)
			);

			const fetchMock = vi.spyOn(globalThis, "fetch");

			if (reason === "EMAIL_REQUEST_FAILED") {
				fetchMock.mockRejectedValue(new Error("Email service unavailable"));
			} else {
				fetchMock.mockResolvedValue(new Response("Email rejected", { status: 503 }));
			}

			const result = await staff.action(api.packagePayment.resendPackageEmail, { packageId });
			const packageRecord = await t.run((ctx) => ctx.db.get("packages", packageId));

			expect({
				result,
				status: packageRecord?.status,
				emailStatus: packageRecord?.receiptEmailStatus,
				error: packageRecord?.receiptEmailFailureCode
			}).toEqual({
				result: [{ reason }, null],
				status: "schedule_email_failed",
				emailStatus: "failed",
				error: reason
			});
		}
	);
});
