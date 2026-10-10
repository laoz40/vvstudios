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
 *    old package expiry must leave the package open, while the current expiry creates its invoice.
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
 *
 * 6. Deferred closeout
 *    Completion and expiry wait for the last session, then create the concrete adjustment and
 *    invoice delivery. Extending expiry prevents the deferred job from closing early.
 *
 * 7. Competing triggers
 *    Completion and expiry racing create one invoice and schedule one automatic delivery.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#/domain/booking/catalog";
import {
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE
} from "#convex/packages/lib/adjustments";
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
		const remoteBookingId = await seedPackageSession(t, packageId, ["Remote Podcast"]);
		await Promise.all([seedPackageSession(t, packageId, []), seedPackageSession(t, packageId, [])]);

		await processCompletedPackage(t, packageId);

		expect(await readAdjustments(t, packageId)).toEqual([]);

		await seedPackageSession(t, packageId, []);
		await processCompletedPackage(t, packageId);

		const [adjustment] = await readAdjustments(t, packageId);
		expect(adjustment).toMatchObject({
			outcome: "invoice_required",
			quantity: 1,
			rate: 59,
			remotePodcastBookingIds: [remoteBookingId],
			totalAmount: 59,
			trigger: "all_sessions_completed"
		});
		expect(await readScheduledJobs(t)).toContainEqual(
			expect.objectContaining({
				args: [{ adjustmentId: adjustment?._id, attempt: "automatic" }],
				scheduledTime: now
			})
		);
	});

	test("completion closeout waits until every scheduled session has ended", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);

		const remoteBookingIds = await Promise.all([
			seedPackageSession(t, packageId, ["Remote Podcast"]),
			seedPackageSession(t, packageId, ["Remote Podcast"], { sessionStartAt: now + 60 * 60 * 1000 })
		]);

		await Promise.all([seedPackageSession(t, packageId, []), seedPackageSession(t, packageId, [])]);

		await processCompletedPackage(t, packageId);

		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(await readScheduledJobs(t)).toHaveLength(1);

		vi.setSystemTime(now + 2 * 60 * 60 * 1000);
		await processCompletedPackage(t, packageId);

		const [adjustment] = await readAdjustments(t, packageId);
		expect(adjustment).toMatchObject({
			outcome: "invoice_required",
			quantity: 2,
			rate: 59,
			totalAmount: 118,
			trigger: "all_sessions_completed"
		});
		expect(adjustment?.remotePodcastBookingIds.toSorted()).toEqual(remoteBookingIds.toSorted());
		expect(await readScheduledJobs(t)).toContainEqual(
			expect.objectContaining({
				args: [{ adjustmentId: adjustment?._id, attempt: "automatic" }],
				scheduledTime: now + 2 * 60 * 60 * 1000
			})
		);
	});

	test("ignores a closeout job for an old package expiry", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		const bookingId = await seedPackageSession(t, packageId, ["Remote Podcast"]);

		await t.mutation(internal.packages.scheduling.processPackageAdjustmentAtExpiry, {
			packageId: packageId,
			expectedExpiresAt: now - 1
		});

		const scheduledJobs = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").collect()
		);

		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(scheduledJobs).toEqual([]);

		await processExpiredPackage(t, packageId);

		const [adjustment] = await readAdjustments(t, packageId);
		expect(adjustment).toMatchObject({
			outcome: "invoice_required",
			quantity: 1,
			rate: 59,
			remotePodcastBookingIds: [bookingId],
			totalAmount: 59,
			trigger: "package_expired"
		});

		if (!adjustment) throw new Error("Expected an invoice adjustment");
		expect(await readScheduledJobs(t)).toContainEqual(
			expect.objectContaining({
				args: [{ adjustmentId: adjustment._id, attempt: "automatic" }],
				scheduledTime: now
			})
		);
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

	test("expiry and completion racing schedule only one invoice delivery", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);

		const remoteBookingIds = await Promise.all([
			seedPackageSession(t, packageId, ["Remote Podcast"]),
			seedPackageSession(t, packageId, ["Remote Podcast"])
		]);

		await seedPackageSession(t, packageId, []);
		await seedPackageSession(t, packageId, []);

		expect(
			await Promise.all([
				processExpiredPackage(t, packageId),
				processCompletedPackage(t, packageId)
			])
		).toEqual([
			[null, null],
			[null, null]
		]);
		await processExpiredPackage(t, packageId);
		await processCompletedPackage(t, packageId);

		const adjustments = await readAdjustments(t, packageId);
		expect(adjustments).toHaveLength(1);
		expect(adjustments[0]).toMatchObject({
			outcome: "invoice_required",
			quantity: 2,
			rate: 59,
			totalAmount: 118,
			invoiceDueAt: Date.parse("2030-01-17T00:00:00.000Z")
		});
		expect(adjustments[0]?.remotePodcastBookingIds).toEqual(
			expect.arrayContaining(remoteBookingIds)
		);
		expect(await readScheduledJobs(t)).toEqual([
			expect.objectContaining({
				args: [{ adjustmentId: adjustments[0]?._id, attempt: "automatic" }],
				scheduledTime: now
			})
		]);
	});

	test("expiry defers to the final session end and records no charge once", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);
		await seedPackageSession(t, packageId, [], { sessionStartAt: now });
		const finalSessionEndAt = now + 60 * 60 * 1000;

		expect(await processExpiredPackage(t, packageId)).toEqual([null, null]);
		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(await readScheduledJobs(t)).toEqual([
			expect.objectContaining({
				args: [{ packageId, expectedExpiresAt: now }],
				scheduledTime: finalSessionEndAt
			})
		]);
		expect(await t.run((ctx) => ctx.db.get("packages", packageId))).toMatchObject({
			archived: false
		});

		vi.setSystemTime(finalSessionEndAt);
		expect(await processExpiredPackage(t, packageId)).toEqual([null, null]);
		await processExpiredPackage(t, packageId);

		expect(await readAdjustments(t, packageId)).toEqual([
			expect.objectContaining({ outcome: "no_charge", quantity: 0, totalAmount: 0 })
		]);
		expect(await readScheduledJobs(t)).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.get("packages", packageId))).toMatchObject({
			archived: true
		});
	});

	test("a deferred expiry cannot close a package after its expiry is extended", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);

		const remoteBookingId = await seedPackageSession(t, packageId, ["Remote Podcast"], {
			sessionStartAt: now
		});

		const extendedExpiryAt = now + 86_400_000;
		await processExpiredPackage(t, packageId);

		await t.run((ctx) => ctx.db.patch("packages", packageId, { expiresAt: extendedExpiryAt }));
		vi.setSystemTime(now + 60 * 60 * 1000);

		expect(await processExpiredPackage(t, packageId)).toEqual([null, null]);
		expect(await readAdjustments(t, packageId)).toEqual([]);
		expect(await readScheduledJobs(t)).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.get("packages", packageId))).toMatchObject({
			archived: false
		});

		vi.setSystemTime(extendedExpiryAt);
		expect(
			await t.mutation(internal.packages.scheduling.processPackageAdjustmentAtExpiry, {
				packageId,
				expectedExpiresAt: extendedExpiryAt
			})
		).toEqual([null, null]);

		const [adjustment] = await readAdjustments(t, packageId);
		expect(adjustment).toMatchObject({
			outcome: "invoice_required",
			quantity: 1,
			rate: 59,
			remotePodcastBookingIds: [remoteBookingId],
			totalAmount: 59,
			trigger: "package_expired"
		});
		expect(await readScheduledJobs(t)).toContainEqual(
			expect.objectContaining({
				args: [{ adjustmentId: adjustment?._id, attempt: "automatic" }],
				scheduledTime: extendedExpiryAt
			})
		);
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
				api.packages.adjustments.markPackageAdjustmentPaymentStatus,
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
				await admin.mutation(api.packages.adjustments.markPackageAdjustmentPaymentStatus, {
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
			await admin.mutation(api.packages.adjustments.markPackageAdjustmentPaymentStatus, {
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
			await admin.mutation(api.packages.adjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: true
			})
		).toEqual([null, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "paid" });

		expect(
			await admin.mutation(api.packages.adjustments.markPackageAdjustmentPaymentStatus, {
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
			await t.mutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, {
				stripeInvoiceId: "in_test_1",
				adjustmentId,
				paidAt
			})
		).toEqual([null, { outcome: "completed", adjustmentId, packageId }]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({ paymentStatus: "paid", paidAt });

		expect(
			await t.mutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, {
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
			await t.mutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, {
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
		await t.mutation(internal.packages.adjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);

		const staleResult = await t.mutation(
			internal.packages.adjustments.markPackageAdjustmentInvoiceEmailSent,
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
		await t.mutation(internal.packages.adjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId,
			claimedAt: firstClaimedAt
		});
		await claimInvoice(t, adjustmentId, retryClaimedAt);

		const staleResult = await t.mutation(
			internal.packages.adjustments.markPackageAdjustmentInvoiceEmailFailed,
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
				createdAt: now - 30 * 24 * 60 * 60 * 1000,
				receiptEmailStatus: "sent",
				paidAt: now - 20 * 24 * 60 * 60 * 1000,
				expiresAt: now,
				stripeCustomerId: "cus_test_package"
			})
		)
	);
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"packages">,
	addons: BookingAddon[],
	overrides: { sessionStartAt?: number; status?: "confirmed" | "cancelled" } = {}
) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
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
				archived: false,
				pendingPaymentCreatedAt: now,
				packageId: packageId
			})
		)
	);
}

async function processExpiredPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.mutation(internal.packages.scheduling.processPackageAdjustmentAtExpiry, {
		packageId: packageId,
		expectedExpiresAt: now
	});
}

async function processCompletedPackage(t: TestClient, packageId: Id<"packages">) {
	return await t.mutation(
		internal.packages.scheduling.processPackageAdjustmentWhenSessionsComplete,
		{ packageId: packageId }
	);
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
	return await t.mutation(internal.packages.adjustments.claimPackageAdjustmentInvoiceEmail, {
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
	return await t.run((ctx) => ctx.db.get("packageAdjustments", adjustmentId));
}

async function readScheduledJobs(t: TestClient) {
	return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}
