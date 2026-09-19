/**
 * These tests cover creating and closing Remote Podcast package adjustment invoices.
 *
 * 1. Adjustment result
 *    A package with no completed Remote Podcast sessions must create one no-charge record.
 *    Completed Remote Podcast sessions must create one unpaid invoice with stored quantity,
 *    rate, total, invoice number, and seven-day due date.
 *
 * 2. Repeated or outdated closeout
 *    Repeated or concurrent closeout jobs must still create only one adjustment. A job for an
 *    old package expiry must do nothing.
 *
 * 3. Email claim
 *    Only one sender may claim an invoice. A timed-out sender's late success or failure must not
 *    overwrite a newer retry.
 *
 * 4. Payment status
 *    Payment status can change after sending or once overdue.
 *
 * 5. Stripe invoice payment
 *    invoice.paid claims mark the adjustment paid once and reject mismatched Stripe invoice ids.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import {
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE
} from "#convex/lib/packageAdjustments";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const completedSessionStartAt = now - 2 * 60 * 60 * 1000;

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("package adjustment closeout", () => {
	test("creates one no-charge record when no completed session used Remote Podcast", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, []);

		await processExpiredPackage(t, packageId);
		const adjustments = await readAdjustments(t, packageId);

		expect(adjustments).toHaveLength(1);
		expect(adjustments[0]).toMatchObject({
			packageId: packageId,
			outcome: "no_charge",
			quantity: 0,
			remotePodcastBookingIds: [],
			totalAmount: 0,
			trigger: "package_expired"
		});
	});

	test("creates one invoice snapshot for completed Remote Podcast sessions", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		const bookingId = await seedPackageSession(t, packageId, ["Remote Podcast"]);

		await processExpiredPackage(t, packageId);
		const [adjustment] = await readAdjustments(t, packageId);

		expect(adjustment).toMatchObject({
			createdAt: now,
			invoiceDueAt: now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
			packageId: packageId,
			outcome: "invoice_required",
			paymentStatus: "unpaid",
			quantity: 1,
			rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
			remotePodcastBookingIds: [bookingId],
			totalAmount: REMOTE_PODCAST_ADJUSTMENT_RATE
		});

		if (!adjustment || adjustment.outcome !== "invoice_required") {
			throw new Error("Expected an invoice-required adjustment");
		}

		expect(adjustment.invoiceNumber).not.toBe("pending");
	});

	test("charges only completed capacity-consuming Remote Podcast sessions from its package", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		const otherPackageId = await seedPaidPackage(t);
		const eligibleBookingId = await seedPackageSession(t, packageId, ["Remote Podcast"]);
		await seedPackageSession(t, packageId, ["Remote Podcast"], { status: "cancelled" });
		await seedPackageSession(t, otherPackageId, ["Remote Podcast"]);

		await processExpiredPackage(t, packageId);
		const [adjustment] = await readAdjustments(t, packageId);

		expect(adjustment).toMatchObject({
			outcome: "invoice_required",
			quantity: 1,
			remotePodcastBookingIds: [eligibleBookingId],
			totalAmount: REMOTE_PODCAST_ADJUSTMENT_RATE
		});
	});

	test("completion closeout waits until every package slot is scheduled", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await Promise.all([
			seedPackageSession(t, packageId, ["Remote Podcast"]),
			seedPackageSession(t, packageId, []),
			seedPackageSession(t, packageId, [])
		]);

		await processCompletedPackage(t, packageId);

		expect(await readAdjustments(t, packageId)).toEqual([]);
	});

	test("completion closeout waits until every scheduled session has ended", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await Promise.all([
			seedPackageSession(t, packageId, ["Remote Podcast"]),
			seedPackageSession(t, packageId, []),
			seedPackageSession(t, packageId, []),
			seedPackageSession(t, packageId, ["Remote Podcast"], { sessionStartAt: now + 60 * 60 * 1000 })
		]);

		await processCompletedPackage(t, packageId);

		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(await readScheduledJobs(t)).toHaveLength(1);
	});

	test("ignores a closeout job for an old package expiry", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, ["Remote Podcast"]);

		await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiry, {
			packageId: packageId,
			expectedExpiresAt: now - 1
		});

		const scheduledJobs = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").collect()
		);

		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(scheduledJobs).toEqual([]);
	});

	test("repeated closeout creates only one adjustment", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		const bookingId = await seedPackageSession(t, packageId, ["Remote Podcast"]);

		await processExpiredPackage(t, packageId);
		await processExpiredPackage(t, packageId);

		const adjustments = await readAdjustments(t, packageId);

		expect(adjustments).toHaveLength(1);
		expect(adjustments[0]).toMatchObject({
			outcome: "invoice_required",
			packageId: packageId,
			quantity: 1,
			remotePodcastBookingIds: [bookingId],
			totalAmount: REMOTE_PODCAST_ADJUSTMENT_RATE
		});
	});

	test("concurrent closeout creates only one adjustment", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, ["Remote Podcast"]);

		await Promise.all([processExpiredPackage(t, packageId), processExpiredPackage(t, packageId)]);

		expect(await readAdjustments(t, packageId)).toHaveLength(1);
	});
});

describe("package adjustment payment", () => {
	test.each(["pending", "failed"] as const)(
		"rejects non-overdue payment changes while invoice email is %s",
		async (invoiceEmailStatus) => {
			const t = createConvexTest();
			const { adjustmentId } = await seedInvoiceAdjustment(t, invoiceEmailStatus);
			const admin = t.withIdentity(adminIdentity);

			const paymentResult = await admin.mutation(
				api.packageAdjustments.markPackageAdjustmentPaymentStatus,
				{ adjustmentId, paid: true }
			);

			expect(paymentResult).toEqual([{ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" }, null]);
			expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "unpaid" });
		}
	);

	test.each(["pending", "failed"] as const)(
		"allows overdue payment changes while invoice email is %s",
		async (invoiceEmailStatus) => {
			const t = createConvexTest();
			const { adjustmentId } = await seedInvoiceAdjustment(t, invoiceEmailStatus, now - 1);
			const admin = t.withIdentity(adminIdentity);

			expect(
				await admin.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
					adjustmentId,
					paid: true
				})
			).toEqual([null, null]);
			expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "paid" });
		}
	);

	test("rejects payment changes for a no-charge adjustment", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);

		const adjustmentId = await t.run((ctx) =>
			ctx.db.insert("packageAdjustments", {
				outcome: "no_charge",
				packageId: packageId,
				trigger: "package_expired",
				remotePodcastBookingIds: [],
				quantity: 0,
				rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
				totalAmount: 0,
				createdAt: now
			})
		);

		const admin = t.withIdentity(adminIdentity);

		expect(
			await admin.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: true
			})
		).toEqual([{ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }, null]);
	});

	test("allows a sent invoice payment status to be toggled", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedInvoiceAdjustment(t, "sent");
		const admin = t.withIdentity(adminIdentity);

		expect(
			await admin.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: true
			})
		).toEqual([null, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "paid" });

		expect(
			await admin.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: false
			})
		).toEqual([null, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "unpaid" });
	});
});

describe("package adjustment stripe invoice payment", () => {
	test("marks a sent adjustment paid once for a matching Stripe invoice", async () => {
		const t = createConvexTest();

		const { adjustmentId, packageId } = await seedInvoiceAdjustment(
			t,
			"sent",
			undefined,
			"in_test_1"
		);

		const paidAt = now + 60 * 60 * 1000;

		expect(
			await t.mutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, {
				stripeInvoiceId: "in_test_1",
				adjustmentId,
				paidAt
			})
		).toEqual([null, { outcome: "completed", adjustmentId, packageId }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "paid", paidAt });

		expect(
			await t.mutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, {
				stripeInvoiceId: "in_test_1",
				adjustmentId,
				paidAt: paidAt + 1
			})
		).toEqual([null, { outcome: "already_completed" }]);
	});

	test("rejects payment claims when the Stripe invoice id does not match", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedInvoiceAdjustment(t, "sent", undefined, "in_test_1");

		expect(
			await t.mutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, {
				stripeInvoiceId: "in_test_other",
				adjustmentId,
				paidAt: now
			})
		).toEqual([{ reason: "STRIPE_INVOICE_MISMATCH" }, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "unpaid" });
	});
});

describe("package adjustment invoice delivery", () => {
	test("sets invoiceEmailClaimedAt on the first claim and rejects a second concurrent claim", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);

		const claims = await Promise.all([
			claimInvoice(t, adjustmentId, now),
			claimInvoice(t, adjustmentId, now)
		]);

		expect(claims.filter(([error]) => error === null)).toHaveLength(1);
		expect(claims).toContainEqual([{ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailClaimedAt: now,
			invoiceEmailStatus: "failed"
		});
	});

	test("rejects a claim after the invoice email was sent without changing sent status", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedInvoiceAdjustment(t, "sent");

		expect(await claimInvoice(t, adjustmentId, now)).toEqual([
			{ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" },
			null
		]);
		const adjustment = await readAdjustment(t, adjustmentId);

		if (!adjustment || adjustment.outcome !== "invoice_required") {
			throw new Error("Expected invoice adjustment");
		}

		expect(adjustment.invoiceEmailStatus).toBe("sent");
		expect(adjustment.invoiceEmailClaimedAt).toBeUndefined();
	});

	test("does not let a timed-out sender overwrite a newer retry", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);
		const firstClaimedAt = now;
		const retryClaimedAt = now + PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS;

		await claimInvoice(t, adjustmentId, firstClaimedAt);
		await t.mutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);

		const staleResult = await t.mutation(
			internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent,
			{ adjustmentId, claimedAt: firstClaimedAt, stripeInvoiceId: "in_test_stale" }
		);

		expect(staleResult).toEqual([null, { updated: false }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailClaimedAt: retryClaimedAt,
			invoiceEmailStatus: "failed"
		});
	});

	test("ignores a timed-out sender's late failure after a newer retry", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);
		const firstClaimedAt = now;
		const retryClaimedAt = now + PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS;

		await claimInvoice(t, adjustmentId, firstClaimedAt);
		await t.mutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);

		const staleResult = await t.mutation(
			internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed,
			{ adjustmentId, claimedAt: firstClaimedAt }
		);

		expect(staleResult).toEqual([null, { updated: false }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailClaimedAt: retryClaimedAt,
			invoiceEmailStatus: "failed"
		});
	});
});

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
	addons: BookingAddon[],
	overrides: { sessionStartAt?: number; status?: "confirmed" | "cancelled" } = {}
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-09",
			time: "10:00",
			sessionStartAt: overrides.sessionStartAt ?? completedSessionStartAt,
			duration: "1h",
			service: "Table Setup",
			addons,
			status: overrides.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			packageId: packageId
		})
	);
}

async function processExpiredPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiry, {
		packageId: packageId,
		expectedExpiresAt: now
	});
}

async function processCompletedPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.mutation(internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete, {
		packageId: packageId
	});
}

async function seedInvoiceAdjustment(
	t: TestClient,
	invoiceEmailStatus: "pending" | "sent" | "failed",
	invoiceDueAt = now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	stripeInvoiceId?: string
) {
	const packageId = await seedPaidPackage(t);

	const adjustmentId = await t.run((ctx) =>
		ctx.db.insert("packageAdjustments", {
			outcome: "invoice_required",
			packageId: packageId,
			trigger: "package_expired",
			remotePodcastBookingIds: [],
			quantity: 2,
			rate: 75,
			totalAmount: 150,
			invoiceNumber: "TEST-ADJ-1",
			createdAt: now,
			invoiceDueAt,
			invoiceEmailStatus,
			stripeInvoiceId,
			paymentStatus: "unpaid"
		})
	);

	return { adjustmentId, packageId };
}

async function seedFailedAdjustment(t: TestClient) {
	return seedInvoiceAdjustment(t, "failed");
}

async function claimInvoice(t: TestClient, adjustmentId: Id<"packageAdjustments">, at: number) {
	return await t.mutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
		adjustmentId,
		attempt: "retry",
		now: at
	});
}

async function readAdjustments(t: TestClient, packageId: Id<"packages">) {
	return await t.run((ctx) =>
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_packageId", (query) => query.eq("packageId", packageId))
			.collect()
	);
}

async function readAdjustment(t: TestClient, adjustmentId: Id<"packageAdjustments">) {
	return await t.run((ctx) => ctx.db.get(adjustmentId));
}

async function readScheduledJobs(t: TestClient) {
	return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}
