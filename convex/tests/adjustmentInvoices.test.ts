/**
 * These tests cover creating and emailing the final Remote Podcast adjustment invoice for a package.
 *
 * 1. Adjustment result
 *    A package with no completed Remote Podcast sessions must create one no-charge record and
 *    send no invoice. Completed Remote Podcast sessions must create one unpaid invoice using
 *    the stored quantity, rate, total, invoice number, and seven-day due date.
 *
 * 2. Repeated or outdated closeout
 *    Repeated or concurrent closeout jobs must still create only one adjustment and send one
 *    automatic invoice email. A job for an old package expiry must do nothing.
 *
 * 3. Email claim
 *    Only one sender may claim an invoice. A timed-out sender's late success or failure must not
 *    overwrite a newer retry.
 *
 * 4. Email result and retry
 *    Successful delivery must mark the invoice sent. Failed delivery must mark it failed so an
 *    admin can retry, using the financial values already stored on the adjustment.
 *
 * Invoice email delivery is replaced with a fake, so no real provider request is made.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE
} from "../lib/packageAdjustments";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({ sendAdjustmentInvoice: vi.fn() }));

vi.mock("../lib/email", () => ({
	sendPackageAdjustmentInvoiceEmail: providerFakes.sendAdjustmentInvoice
}));

const now = Date.parse("2030-01-10T00:00:00.000Z");
const completedSessionStartAt = now - 2 * 60 * 60 * 1000;
const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(now);
	providerFakes.sendAdjustmentInvoice.mockResolvedValue([null, { sent: true }]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("package adjustment closeout", () => {
	test("creates one no-charge record when no completed session used Remote Podcast", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageBooking(t, packageId, []);

		await processExpiredPackage(t, packageId);
		const adjustments = await readAdjustments(t, packageId);

		expect(adjustments).toHaveLength(1);
		expect(adjustments[0]).toMatchObject({
			multiBookingId: packageId,
			outcome: "no_charge",
			quantity: 0,
			remotePodcastBookingIds: [],
			totalAmount: 0,
			trigger: "package_expired"
		});
		expect(providerFakes.sendAdjustmentInvoice).not.toHaveBeenCalled();
	});

	test("creates and sends one invoice snapshot for completed Remote Podcast sessions", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		const bookingId = await seedPackageBooking(t, packageId, ["Remote Podcast"]);

		await processExpiredPackage(t, packageId);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());
		const [adjustment] = await readAdjustments(t, packageId);

		expect(adjustment).toMatchObject({
			createdAt: now,
			invoiceDueAt: now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
			invoiceEmailStatus: "sent",
			multiBookingId: packageId,
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
		expect(providerFakes.sendAdjustmentInvoice).toHaveBeenCalledTimes(1);
	});

	test("ignores a closeout job for an old package expiry", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageBooking(t, packageId, ["Remote Podcast"]);

		await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiryInternal, {
			multiBookingId: packageId,
			expectedExpiresAt: now - 1
		});
		const scheduledJobs = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").collect()
		);

		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(scheduledJobs).toEqual([]);
		expect(providerFakes.sendAdjustmentInvoice).not.toHaveBeenCalled();
	});

	test("repeated concurrent closeout creates and sends only one adjustment", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageBooking(t, packageId, ["Remote Podcast"]);

		await Promise.all([
			processExpiredPackage(t, packageId),
			processExpiredPackage(t, packageId),
			processExpiredPackage(t, packageId)
		]);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		expect(await readAdjustments(t, packageId)).toHaveLength(1);
		expect(providerFakes.sendAdjustmentInvoice).toHaveBeenCalledTimes(1);
	});
});

describe("package adjustment invoice delivery", () => {
	test("allows only one sender to claim an invoice", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);

		const claims = await Promise.all([
			claimInvoice(t, adjustmentId, now),
			claimInvoice(t, adjustmentId, now)
		]);

		expect(claims.filter(([error]) => error === null)).toHaveLength(1);
		expect(claims).toContainEqual([{ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }, null]);
	});

	test("does not let a timed-out sender overwrite a newer retry", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);
		const firstClaimedAt = now;
		const retryClaimedAt = now + PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS;

		await claimInvoice(t, adjustmentId, firstClaimedAt);
		await t.mutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailedInternal, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);
		const staleResult = await t.mutation(
			internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSentInternal,
			{ adjustmentId, claimedAt: firstClaimedAt }
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
		await t.mutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailedInternal, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);
		const staleResult = await t.mutation(
			internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailedInternal,
			{ adjustmentId, claimedAt: firstClaimedAt }
		);

		expect(staleResult).toEqual([null, { updated: false }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailClaimedAt: retryClaimedAt,
			invoiceEmailStatus: "failed"
		});
	});

	test("records a successful invoice delivery using the stored financial snapshot", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail, { adjustmentId });
		const source = providerFakes.sendAdjustmentInvoice.mock.calls[0]?.[0];

		expect(result).toEqual([null, { sent: true }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ invoiceEmailStatus: "sent" });
		expect(source.adjustment).toMatchObject({ quantity: 2, rate: 75, totalAmount: 150 });
	});

	test("records provider failure and allows an admin retry", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedFailedAdjustment(t);
		providerFakes.sendAdjustmentInvoice
			.mockResolvedValueOnce([{ reason: "INVOICE_SEND_FAILED" }, null])
			.mockResolvedValueOnce([null, { sent: true }]);

		const firstResult = await t
			.withIdentity(adminIdentity)
			.action(api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail, { adjustmentId });
		const failedAdjustment = await readAdjustment(t, adjustmentId);
		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.packageAdjustmentInvoices.retryPackageAdjustmentInvoiceEmail, { adjustmentId });

		expect(firstResult).toEqual([{ reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" }, null]);
		expect(failedAdjustment).toMatchObject({ invoiceEmailStatus: "failed" });
		if (!failedAdjustment || failedAdjustment.outcome !== "invoice_required") {
			throw new Error("Expected an invoice-required adjustment");
		}
		expect(failedAdjustment.invoiceEmailClaimedAt).toBeUndefined();
		expect(retryResult).toEqual([null, { sent: true }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ invoiceEmailStatus: "sent" });
		expect(providerFakes.sendAdjustmentInvoice).toHaveBeenCalledTimes(2);
	});
});

async function seedPaidPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("multiBookingPackages", {
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
			invoiceDueAt: now,
			invoiceEmailStatus: "sent",
			paidAt: now - 20 * 24 * 60 * 60 * 1000,
			expiresAt: now
		})
	);
}

async function seedPackageBooking(
	t: TestClient,
	packageId: Id<"multiBookingPackages">,
	addons: string[]
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
			multiBookingPackageId: packageId
		})
	);
}

async function processExpiredPackage(t: TestClient, packageId: Id<"multiBookingPackages">) {
	return await t.mutation(internal.packageScheduling.processPackageAdjustmentAtExpiryInternal, {
		multiBookingId: packageId,
		expectedExpiresAt: now
	});
}

async function seedFailedAdjustment(t: TestClient) {
	const packageId = await seedPaidPackage(t);
	const adjustmentId = await t.run((ctx) =>
		ctx.db.insert("packageAdjustments", {
			outcome: "invoice_required",
			multiBookingId: packageId,
			trigger: "package_expired",
			remotePodcastBookingIds: [],
			quantity: 2,
			rate: 75,
			totalAmount: 150,
			invoiceNumber: "TEST-ADJ-1",
			createdAt: now,
			invoiceDueAt: now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
			invoiceEmailStatus: "failed",
			paymentStatus: "unpaid"
		})
	);
	return { adjustmentId, packageId };
}

async function claimInvoice(t: TestClient, adjustmentId: Id<"packageAdjustments">, at: number) {
	return await t.mutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmailInternal, {
		adjustmentId,
		attempt: "retry",
		now: at
	});
}

async function readAdjustments(t: TestClient, packageId: Id<"multiBookingPackages">) {
	return await t.run((ctx) =>
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_multiBookingId", (query) => query.eq("multiBookingId", packageId))
			.collect()
	);
}

async function readAdjustment(t: TestClient, adjustmentId: Id<"packageAdjustments">) {
	return await t.run((ctx) => ctx.db.get(adjustmentId));
}
