/**
 * These tests cover admin package management.
 *
 * 1. Capacity-safe sizing
 *    Shrinking below active booked sessions is rejected without changing the package.
 *
 * 2. Pricing edits
 *    Admin edits recalculate pricing snapshots, including quantity add-ons and line-item totals.
 *
 * 3. Package payment claim
 *    Payment claim creates one paid lifecycle, one expiry job, and slot accounting on the package row.
 *
 * 4. Receipt synchronization
 *    Replays keep every package session searchable without changing another package's sessions.
 *    A failed editor lookup rolls back the package receipt and all session receipt updates.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#/domain/booking/catalog";
import { getPackageExpiresAt } from "#/domain/booking/pricing";
import { hashRescheduleToken } from "#convex/sessions/lib/sessionRescheduleLinks";
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
			internal.packages.packages.markPackagePaidAndCreateScheduleToken,
			{ packageId, paidAt: now }
		);

		if (error !== null) throw new Error("Expected package payment claim");

		const packageRecord = await readPackage(t, packageId);
		const scheduledJobs = await readScheduledJobs(t);

		expect(packageRecord).toMatchObject({
			expiresAt,
			paidAt: now,
			scheduleLinkStatus: "active",
			status: "schedule_email_failed"
		});
		expect(packageRecord?.scheduleTokenHash).toBe(await hashRescheduleToken(paymentResult.token));
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
			await t.mutation(internal.packages.packages.markPackagePaidAndCreateScheduleToken, {
				packageId,
				paidAt: now
			})
		).toEqual([null, expect.objectContaining({ paidAt: now })]);
		expect(
			await t.mutation(internal.packages.packages.markPackagePaidAndCreateScheduleToken, {
				packageId,
				paidAt: now + 1
			})
		).toEqual([{ reason: "PACKAGE_ALREADY_PAID" }, null]);
		expect(await readScheduledJobs(t)).toHaveLength(1);
	});

	test("moves pending_payment to paid only once", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);

		await t.mutation(internal.packages.packages.markPackagePaidAndCreateScheduleToken, {
			packageId,
			paidAt: now
		});
		await t.mutation(internal.packages.packages.markPackageScheduleEmailAttempt, {
			packageId,
			status: "sent"
		});
		await t.mutation(internal.packages.packages.markPackageScheduleEmailAttempt, {
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
			.mutation(api.packages.packages.updatePackageFromAdmin, {
				packageId: packageId,
				...editedPackage,
				packageSize: 4
			});

		expect(result).toEqual([{ reason: "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" }, null]);
		expect(await readPackage(t, packageId)).toEqual(packageBefore);
	});

	test("recalculates quantity add-on pricing on a four-session package", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const result = await admin.mutation(api.packages.packages.updatePackageFromAdmin, {
			packageId: packageId,
			name: "Updated customer",
			phone: "0411 111 111",
			accountName: "Updated account",
			email: "updated@example.com",
			duration: "1h",
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "2",
			notes: "Updated notes",
			packageSize: 4
		});

		const packageRecord = await readPackage(t, packageId);

		if (!packageRecord?.invoiceLineItems) throw new Error("Expected package invoice snapshot");

		const lineItemTotal = packageRecord.invoiceLineItems.reduce(
			(total, item) => total + item.amount,
			0
		);

		expect(result).toEqual([null, null]);
		expect(packageRecord).toMatchObject({
			singleSessionAmount: 400,
			packageSubtotalAmount: 1600,
			discountPercent: 5,
			discountAmount: 80,
			totalDueAmount: 1520
		});
		expect(lineItemTotal).toBe(1520);
	});

	test("updates a coherent pricing snapshot", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const calculatedResult = await admin.mutation(api.packages.packages.updatePackageFromAdmin, {
			packageId: packageId,
			...editedPackage
		});

		const calculatedPackage = await readPackage(t, packageId);

		if (!calculatedPackage?.invoiceLineItems) throw new Error("Expected package invoice snapshot");

		expect(calculatedResult).toEqual([null, null]);
		expect(calculatedPackage).toMatchObject({
			...editedPackage,
			phone: "0411111111",
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
	});
});

describe("package receipt number", () => {
	test("stores receipt on the package and copies it to package session bookings", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0, "confirmed");
		const receiptNumber = "VV-20300101-ABCD";

		const [error] = await t.mutation(internal.packages.packages.markPackageReceiptEmailAttempt, {
			packageId,
			receiptNumber,
			status: "sent"
		});

		expect(error).toBeNull();

		const packageRecord = await readPackage(t, packageId);
		expect(packageRecord?.receiptNumber).toBe(receiptNumber);

		const booking = await t.run((ctx) => ctx.db.get("bookings", bookingId));
		expect(booking?.receiptNumber).toBe(receiptNumber);
	});

	test("receipt replays synchronize session search and preserve editor names", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);
		const otherPackageId = await seedPendingPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0, "confirmed");
		const cachedEditorBookingId = await seedPackageSession(t, packageId, 1, "email_failed");
		const cancelledBookingId = await seedPackageSession(t, packageId, 2, "confirmed");
		await seedPackageSession(t, otherPackageId, 3, "confirmed");
		await seedEditorProfile(t, "editor-token", "Lookup Editor");
		await t.run(async (ctx) => {
			await ctx.db.patch("bookings", bookingId, { assignedEditorTokenIdentifier: "editor-token" });
			await ctx.db.patch("bookings", cachedEditorBookingId, {
				assignedEditorTokenIdentifier: "cached-editor-token",
				assignedEditorDisplayName: "Cached Editor"
			});
			await ctx.db.patch("bookings", cancelledBookingId, { status: "cancelled", archived: true });
		});
		const receiptNumber = "VV-20300101-REPLAY";

		const receiptArgs = { packageId, receiptNumber, status: "sent" as const };

		expect(
			await t.mutation(internal.packages.packages.markPackageReceiptEmailAttempt, receiptArgs)
		).toEqual([null, null]);
		expect(
			await t.mutation(internal.packages.packages.markPackageReceiptEmailAttempt, receiptArgs)
		).toEqual([null, null]);

		const sessions = await readAdminSessions(t, `receipt:${receiptNumber}`);
		expect(sessions).toHaveLength(3);
		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					_id: bookingId,
					receiptNumber,
					assignedEditorDisplayName: "Lookup Editor"
				}),
				expect.objectContaining({
					_id: cachedEditorBookingId,
					receiptNumber,
					assignedEditorDisplayName: "Cached Editor"
				}),
				expect.objectContaining({ _id: cancelledBookingId, receiptNumber })
			])
		);
		expect(sessions.every((session) => session.searchBlob.includes(receiptNumber))).toBe(true);
		expect(sessions.find((session) => session._id === bookingId)?.searchBlob).toContain(
			"Lookup Editor"
		);
		expect(sessions.find((session) => session._id === cachedEditorBookingId)?.searchBlob).toContain(
			"Cached Editor"
		);
	});

	test("receipt lookup failure rolls back the package and every session", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0, "confirmed");
		await seedPackageSession(t, packageId, 1, "confirmed");
		await t.run((ctx) =>
			ctx.db.patch("bookings", bookingId, { assignedEditorTokenIdentifier: "duplicate-editor" })
		);
		await seedEditorProfile(t, "duplicate-editor", "First Editor");
		await seedEditorProfile(t, "duplicate-editor", "Second Editor");
		const packageBefore = await readPackage(t, packageId);
		const sessionsBefore = await readAdminSessions(t);

		await expect(
			t.mutation(internal.packages.packages.markPackageReceiptEmailAttempt, {
				packageId,
				receiptNumber: "VV-20300101-ROLLBACK",
				status: "sent"
			})
		).rejects.toThrow();

		expect(await readPackage(t, packageId)).toEqual(packageBefore);
		expect(await readAdminSessions(t)).toEqual(sessionsBefore);
	});
});

async function seedEditorProfile(t: TestClient, tokenIdentifier: string, displayName: string) {
	return await t.run((ctx) =>
		ctx.db.insert("editorProfiles", {
			tokenIdentifier,
			displayName,
			email: "editor@example.com",
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		})
	);
}

async function readAdminSessions(t: TestClient, searchQuery?: string) {
	const result = await t
		.withIdentity(adminIdentity)
		.query(api.sessions.sessions.listSessions, {
			paginationOpts: { numItems: 20, cursor: null },
			view: "all",
			includeStale: true,
			searchQuery
		});

	return result.page;
}

async function seedPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
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
				archived: false,
				createdAt: now,
				paidAt: now,
				expiresAt: now + 100_000,
				receiptEmailStatus: "sent"
			})
		)
	);
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"packages">,
	index: number,
	status: "confirmed" | "email_failed"
) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
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
				archived: false,
				pendingPaymentCreatedAt: now,
				packageId: packageId
			})
		)
	);
}

async function readPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.run((ctx) => ctx.db.get("packages", packageId));
}

async function seedPendingPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
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
				archived: false,
				createdAt: now,
				receiptEmailStatus: "sent"
			})
		)
	);
}

async function seedPaidPackageWithToken(t: TestClient) {
	const scheduleTokenHash = await hashRescheduleToken(packageScheduleToken);

	return await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
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
				archived: false,
				createdAt: now,
				paidAt: now,
				expiresAt: getPackageExpiresAt(now, 4),
				receiptEmailStatus: "sent",
				scheduleTokenHash,
				scheduleLinkStatus: "active"
			})
		)
	);
}

async function readPackageSlots(t: TestClient, token: string) {
	const [error, packageRecord] = await t.query(api.packages.packageScheduling.getPackageByToken, {
		token
	});

	if (error !== null) throw new Error("Expected package scheduling data");

	return { packageSize: packageRecord.packageSize, bookedSessions: packageRecord.sessions.length };
}

async function readScheduledJobs(t: TestClient) {
	return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}
