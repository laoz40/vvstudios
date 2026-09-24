/**
 * Package auto-archive integration.
 *
 * 1. Dead checkout
 *    Abandoned pending packages set hiddenAt.
 *
 * 2. Closed window
 *    Expired packages with a resolved no-charge adjustment archive after closeout.
 *
 * 3. Paid invoices
 *    Marking the last custom package invoice paid archives a finished package.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const completedSessionStartAt = now - 2 * 60 * 60 * 1000;

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("package auto-archive", () => {
	test("sets hiddenAt when a pending package is abandoned", async () => {
		const t = createConvexTest();
		const packageId = await seedPendingPackage(t, "cs_abandon_archive");

		await t.mutation(internal.packageCheckout.deletePendingPackage, {
			packageId,
			stripeSessionId: "cs_abandon_archive"
		});

		expect(await readPackage(t, packageId)).toMatchObject({ status: "abandoned", hiddenAt: now });
	});

	test("archives after expiry closeout with a no-charge adjustment", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, []);

		await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiry, {
			packageId,
			expectedExpiresAt: now
		});

		expect(await readPackage(t, packageId)).toMatchObject({ hiddenAt: now });
	});

	test("archives after the last custom package invoice is marked paid", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, []);

		await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiry, {
			packageId,
			expectedExpiresAt: now
		});

		await t.run((ctx) => ctx.db.patch(packageId, { hiddenAt: undefined }));

		await t.mutation(internal.stripeInvoices.recordPackageStripeInvoice, {
			packageId,
			stripeInvoiceId: "in_pkg_paid_archive",
			lineItems: [{ description: "Extra", amount: 80 }],
			requestId: "req_pkg_paid_archive"
		});

		await t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
			stripeInvoiceId: "in_pkg_paid_archive",
			paidAt: now
		});

		expect(await readPackage(t, packageId)).toMatchObject({ hiddenAt: now });
	});
});

async function seedPendingPackage(t: TestClient, stripeSessionId: string) {
	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "pending@example.com",
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
			stripeSessionId
		})
	);
}

async function seedPaidPackage(t: TestClient) {
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
			createdAt: now - 30 * 24 * 60 * 60 * 1000,
			invoiceEmailStatus: "sent",
			paidAt: now - 20 * 24 * 60 * 60 * 1000,
			expiresAt: now,
			stripeCustomerId: "cus_test_package"
		})
	);
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"packages">,
	addons: Doc<"bookings">["addons"]
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-09",
			time: "10:00",
			sessionStartAt: completedSessionStartAt,
			duration: "1h",
			service: "Table Setup",
			addons,
			status: "confirmed",
			pendingPaymentCreatedAt: now,
			packageId
		})
	);
}

async function readPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.run((ctx) => ctx.db.get(packageId));
}
