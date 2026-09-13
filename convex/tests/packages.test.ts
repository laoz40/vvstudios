/**
 * These tests cover admin package management.
 *
 * 1. Capacity-safe sizing
 *    Shrinking below active booked sessions is rejected without changing the package.
 *
 * 2. Pricing edits
 *    Admin edits store a coherent pricing snapshot and isolate a custom final total.
 *
 * 3. Package payment claim
 *    Payment claim creates one paid lifecycle, one expiry job, and slot accounting on the package row.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { getPackageExpiresAt } from "#studio/features/booking-form/lib/booking-pricing";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

const editedPackage = {
	name: "Updated customer",
	phone: "0411 111 111",
	accountName: "Updated account",
	email: "updated@example.com",
	duration: "2h",
	addons: ["Teleprompter"] satisfies BookingAddon[],
	notes: "Updated notes",
	packageSize: 8 as const
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
});

const packageScheduleToken = "package-payment-token";

describe("package payment claim", () => {
	test("creates one paid lifecycle and expiry job", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);
		const expiresAt = getPackageExpiresAt(now, 4);

		const [error, paymentResult] = await t.mutation(
			internal.packages.markPackagePaidAndCreateScheduleToken,
			{ packageId, paidAt: now }
		);

		if (error !== null || !paymentResult) throw new Error("Expected package payment claim");

		const packageRecord = await readPackage(t, packageId);
		const scheduledJobs = await readScheduledJobs(t);

		expect(packageRecord).toMatchObject({
			expiresAt,
			paidAt: now,
			scheduleLinkStatus: "active",
			status: "schedule_email_failed"
		});
		expect(packageRecord?.scheduleTokenHash).toBe(
			await hashRescheduleToken(paymentResult.token)
		);
		expect(scheduledJobs).toHaveLength(1);
		expect(scheduledJobs[0]).toMatchObject({
			args: [{ expectedExpiresAt: expiresAt, packageId }],
			scheduledTime: expiresAt
		});
	});

	test("rejects a repeated payment claim without replacing the paid lifecycle", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);

		expect(
			await t.mutation(internal.packages.markPackagePaidAndCreateScheduleToken, {
				packageId,
				paidAt: now
			})
		).toEqual([null, expect.objectContaining({ paidAt: now })]);
		expect(
			await t.mutation(internal.packages.markPackagePaidAndCreateScheduleToken, {
				packageId,
				paidAt: now + 1
			})
		).toEqual([{ reason: "PACKAGE_ALREADY_PAID" }, null]);
		expect(await readScheduledJobs(t)).toHaveLength(1);
	});

	test("moves pending_payment to paid only once", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);

		await t.mutation(internal.packages.markPackagePaidAndCreateScheduleToken, {
			packageId,
			paidAt: now
		});
		await t.mutation(internal.packages.markPackageScheduleEmailAttempt, {
			packageId,
			status: "sent"
		});
		await t.mutation(internal.packages.markPackageScheduleEmailAttempt, {
			packageId,
			status: "sent"
		});

		expect(await readPackage(t, packageId)).toMatchObject({ status: "paid", paidAt: now });
	});

	test("reduces available package slots as sessions are booked", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackageWithToken(t);

		expect(await readPackageSlots(t, packageScheduleToken)).toEqual({
			packageSize: 4,
			bookedSessions: 0
		});

		await seedPackageSession(t, packageId, 0, "confirmed");
		await seedPackageSession(t, packageId, 1, "confirmed");

		expect(await readPackageSlots(t, packageScheduleToken)).toEqual({
			packageSize: 4,
			bookedSessions: 2
		});
	});
});

describe("admin package management", () => {
	test("rejects shrinking below active capacity without changing the package", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				seedPackageSession(t, packageId, index, index === 4 ? "email_failed" : "confirmed")
			)
		);
		const packageBefore = await readPackage(t, packageId);

		const result = await t
			.withIdentity(adminIdentity)
			.mutation(api.packages.updatePackageFromAdmin, {
				packageId: packageId,
				...editedPackage,
				packageSize: 4
			});

		expect(result).toEqual([{ reason: "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" }, null]);
		expect(await readPackage(t, packageId)).toEqual(packageBefore);
	});

	test("updates a coherent pricing snapshot and isolates a custom final total", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const calculatedResult = await admin.mutation(api.packages.updatePackageFromAdmin, {
			packageId: packageId,
			...editedPackage
		});

		const calculatedPackage = await readPackage(t, packageId);

		if (!calculatedPackage?.invoiceLineItems) throw new Error("Expected package invoice snapshot");

		expect(calculatedResult).toEqual([null, null]);
		expect(calculatedPackage).toMatchObject({
			...editedPackage,
			singleSessionAmount: 328,
			packageSubtotalAmount: 2624,
			discountPercent: 10,
			discountAmount: 262.4,
			totalDueAmount: 2361.6,
			invoiceLineItems: [
				{ amount: 2392, description: "Studio Hire (2h)", quantity: 8, rate: 299 },
				{ amount: 232, description: "Teleprompter add-on", quantity: 8, rate: 29 },
				{ amount: -262.4, description: "10% package discount", quantity: 1, rate: -262.4 }
			]
		});

		const customResult = await admin.mutation(api.packages.updatePackageFromAdmin, {
			packageId: packageId,
			...editedPackage,
			totalDueAmount: 2000
		});

		const customPackage = await readPackage(t, packageId);

		expect(customResult).toEqual([null, null]);
		expect(customPackage).toEqual({
			...calculatedPackage,
			totalDueAmount: 2000,
			invoiceLineItems: [
				...calculatedPackage.invoiceLineItems,
				{
					amount: -361.5999999999999,
					description: "Price adjustment",
					quantity: 1,
					rate: -361.5999999999999
				}
			]
		});
	});
});

async function seedPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400 000 000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 8,
			singleSessionAmount: 200,
			packageSubtotalAmount: 1600,
			discountPercent: 10,
			discountAmount: 160,
			totalDueAmount: 1440,
			invoiceLineItems: [
				{ amount: 1600, description: "Studio Hire (1h)", quantity: 8, rate: 200 },
				{ amount: -160, description: "10% package discount", quantity: 1, rate: -160 }
			],
			status: "paid",
			createdAt: now,
			invoiceDueAt: now,
			paidAt: now,
			expiresAt: now + 100_000,
			invoiceEmailStatus: "sent"
		})
	);
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"packages">,
	index: number,
	status: "confirmed" | "email_failed"
) {
	await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400 000 000",
			accountName: "Test account",
			email: "customer@example.com",
			date: `2030-01-${String(index + 2).padStart(2, "0")}`,
			time: "10:00",
			sessionStartAt: now + (index + 1) * 86_400_000,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status,
			pendingPaymentCreatedAt: now,
			packageId: packageId
		})
	);
}

async function readPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.run((ctx) => ctx.db.get(packageId));
}

async function seedPendingPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: "pending_payment",
			createdAt: now,
			invoiceDueAt: now,
			invoiceEmailStatus: "sent"
		})
	);
}

async function seedPaidPackageWithToken(t: TestClient) {
	const scheduleTokenHash = await hashRescheduleToken(packageScheduleToken);

	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: "paid",
			createdAt: now,
			invoiceDueAt: now,
			paidAt: now,
			expiresAt: getPackageExpiresAt(now, 4),
			invoiceEmailStatus: "sent",
			scheduleTokenHash,
			scheduleLinkStatus: "active"
		})
	);
}

async function readPackageSlots(t: TestClient, token: string) {
	const [error, packageRecord] = await t.query(api.packageScheduling.getPackageByToken, { token });

	if (error !== null || !packageRecord) throw new Error("Expected package scheduling data");

	return {
		packageSize: packageRecord.packageSize,
		bookedSessions: packageRecord.sessions.length
	};
}

async function readScheduledJobs(t: TestClient) {
	return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}
