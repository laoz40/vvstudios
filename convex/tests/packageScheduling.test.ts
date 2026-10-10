/**
 * These tests cover reading package sessions from a customer scheduling link.
 *
 * 1. Public scheduling-link access
 *    Unknown, unpaid, disabled, and expired links cannot read package scheduling data.
 *
 * 2. Scheduling token validation
 *    Unknown and expired tokens cannot create records, while a valid paid token creates a session.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { google } from "googleapis";
import { packageDocument } from "#convex/tests/insertDocumentDefaults";
import { api } from "#convex/_generated/api";
import { hashRescheduleToken } from "#convex/sessions/lib/sessionRescheduleLinks";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const target = {
	date: "2030-01-11",
	time: "10:00",
	service: "Table Setup" as const,
	remotePodcast: false
};

function sendCalendarRequest(input: RequestInfo | URL, init?: RequestInit) {
	const url = new URL(input instanceof Request ? input.url : input);

	if (init?.method === "POST") return Promise.resolve(Response.json({ id: "created_event" }));

	if (url.pathname.endsWith("/events")) return Promise.resolve(Response.json({ items: [] }));

	return Promise.resolve(Response.json({ status: "confirmed" }));
}

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);

	const calendar = google.calendar({
		version: "v3",
		auth: "test-api-key",
		fetchImplementation: sendCalendarRequest,
		retry: false
	});

	vi.spyOn(google, "calendar").mockReturnValue(calendar);
});

afterEach(() => vi.restoreAllMocks());

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

		const result = await t.query(api.packages.packageScheduling.getPackageByToken, {
			token: seededPackage?.token ?? "unknown-token"
		});

		expect(result).toEqual([{ reason: testCase.expectedReason }, null]);
	});
});

describe("package session creation validation", () => {
	test("rejects an invalid token without creating records", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packages.packageScheduling.createPackageSession, {
			token: "unknown-token",
			...target
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
		expect(await readBookings(t)).toEqual([]);
		const validPackage = await seedPackage(t, {}, "valid-schedule-token");
		await seedSettings(t);

		const validResult = await t.action(api.packages.packageScheduling.createPackageSession, {
			token: validPackage.token,
			...target
		});

		expect(validResult[0]).toBeNull();
		expect(
			await t.query(api.packages.packageScheduling.getPackageByToken, { token: validPackage.token })
		).toMatchObject([
			null,
			expect.objectContaining({
				sessions: [expect.objectContaining({ date: "2030-01-11", time: "10:00" })]
			})
		]);
	});

	test("rejects an expired package without creating records", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t, { expiresAt: now });

		const result = await t.action(api.packages.packageScheduling.createPackageSession, {
			token,
			...target
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_EXPIRED" }, null]);
		expect(await readBookings(t)).toEqual([]);
		const validPackage = await seedPackage(t, {}, "valid-schedule-token");
		await seedSettings(t);

		const validResult = await t.action(api.packages.packageScheduling.createPackageSession, {
			token: validPackage.token,
			...target
		});

		expect(validResult[0]).toBeNull();
		expect(
			await t.query(api.packages.packageScheduling.getPackageByToken, { token: validPackage.token })
		).toMatchObject([
			null,
			expect.objectContaining({
				sessions: [expect.objectContaining({ date: "2030-01-11", time: "10:00" })]
			})
		]);
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
		ctx.db.insert(
			"packages",
			packageDocument({
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
				archived: false,
				createdAt: now - 1_000,
				paidAt: now - 100,
				expiresAt: overrides.expiresAt ?? Date.parse("2030-01-20T00:00:00.000Z"),
				receiptEmailStatus: "sent",
				scheduleTokenHash,
				scheduleLinkStatus: overrides.scheduleLinkStatus ?? "active"
			})
		)
	);

	return { packageId, token };
}

async function readBookings(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("bookings").collect());
}

async function seedSettings(t: TestClient) {
	await t.run((ctx) =>
		ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 30,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		})
	);
}
