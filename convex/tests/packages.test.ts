/**
 * These tests cover admin package management.
 *
 * 1. Capacity-safe sizing
 *    Shrinking below active booked sessions is rejected without changing the package.
 *
 * 2. Pricing edits
 *    Admin edits store a coherent pricing snapshot and isolate a custom final total.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
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
