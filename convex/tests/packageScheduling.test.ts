/**
 * These tests cover reading package sessions from a customer scheduling link.
 *
 * 1. Public scheduling-link access
 *    Unknown, unpaid, disabled, and expired links cannot read package scheduling data.
 *
 * 2. Invalid scheduling token
 *    An unknown or expired token cannot create any records.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const target = {
	date: "2030-01-11",
	time: "10:00",
	service: "Table Setup" as const,
	remotePodcast: false
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
});

describe("package scheduling link access", () => {
	test.each([
		{ name: "unknown", seed: false, overrides: {}, expectedReason: "PACKAGE_LINK_INVALID" },
		{
			name: "unpaid",
			seed: true,
			overrides: { status: "pending_payment" as const },
			expectedReason: "PACKAGE_NOT_PAID"
		},
		{
			name: "disabled",
			seed: true,
			overrides: { scheduleLinkStatus: "disabled" as const },
			expectedReason: "PACKAGE_LINK_INACTIVE"
		},
		{
			name: "expired",
			seed: true,
			overrides: { expiresAt: now },
			expectedReason: "PACKAGE_LINK_EXPIRED"
		}
	])("rejects a $name token on the public read path", async (testCase) => {
		const t = createConvexTest();
		const seededPackage = testCase.seed ? await seedPackage(t, testCase.overrides) : null;

		const result = await t.query(api.packageScheduling.getPackageByToken, {
			token: seededPackage?.token ?? "unknown-token"
		});

		expect(result).toEqual([{ reason: testCase.expectedReason }, null]);
	});
});

describe("package session creation validation", () => {
	test("rejects an invalid token without creating records", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packageScheduling.createPackageSession, {
			token: "unknown-token",
			...target
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
		expect(await readBookings(t)).toEqual([]);
	});

	test("rejects an expired package without creating records", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t, { expiresAt: now });

		const result = await t.action(api.packageScheduling.createPackageSession, { token, ...target });

		expect(result).toEqual([{ reason: "PACKAGE_LINK_EXPIRED" }, null]);
		expect(await readBookings(t)).toEqual([]);
	});
});

async function seedPackage(
	t: TestClient,
	overrides: {
		expiresAt?: number;
		scheduleLinkStatus?: "active" | "disabled";
		status?: "paid" | "pending_payment";
	} = {},
	token = "package-scheduling-token"
) {
	const scheduleTokenHash = await hashRescheduleToken(token);

	const packageId = await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: ["4K UHD Recording"],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 10,
			discountAmount: 40,
			totalDueAmount: 360,
			status: overrides.status ?? "paid",
			createdAt: now - 1_000,
			invoiceDueAt: now - 500,
			paidAt: now - 100,
			expiresAt: overrides.expiresAt ?? Date.parse("2030-01-20T00:00:00.000Z"),
			invoiceEmailStatus: "sent",
			scheduleTokenHash,
			scheduleLinkStatus: overrides.scheduleLinkStatus ?? "active"
		})
	);

	return { packageId, token };
}

async function readBookings(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("bookings").collect());
}
