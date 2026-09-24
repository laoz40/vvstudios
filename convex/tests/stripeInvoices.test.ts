/**
 * These tests cover persisting Stripe invoices and marking them paid.
 *
 * 1. Record booking invoice
 *    Sending an ad-hoc booking invoice stores one unpaid stripeInvoices row.
 *
 * 2. Idempotent record
 *    Re-recording the same requestId or stripeInvoiceId must not create duplicates.
 *
 * 3. Mark paid
 *    invoice.paid handling marks a stored invoice paid once and ignores unknown ids.
 *
 * 4. Adjustment invoice record
 *    Marking a package adjustment invoice sent also stores one stripeInvoices row.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("stripe invoice persistence", () => {
	test("stores one unpaid booking invoice record", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const recordResult = await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_test_booking",
			lineItems: [{ description: "Extra editing", amount: 120 }],
			requestId: "req_booking_1",
			createdBy: "admin@example.com"
		});

		expect(recordResult[0]).toBeNull();
		expect(recordResult[1]).toMatchObject({ created: true });
		expect(recordResult[1]?.stripeInvoiceRecordId).toBeDefined();

		const [error, invoices] = await t
			.withIdentity(adminIdentity)
			.query(api.stripeInvoices.listStripeInvoicesForBooking, { bookingId });

		expect(error).toBeNull();
		expect(invoices).toHaveLength(1);
		expect(invoices?.[0]).toMatchObject({
			kind: "booking",
			bookingId,
			stripeInvoiceId: "in_test_booking",
			totalAmount: 120,
			paymentStatus: "unpaid",
			requestId: "req_booking_1",
			createdBy: "admin@example.com"
		});
	});

	test("does not create duplicate records for the same requestId or stripeInvoiceId", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const firstRecord = await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_test_booking",
			lineItems: [{ description: "Extra editing", amount: 120 }],
			requestId: "req_booking_1"
		});

		const secondRecord = await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_test_booking",
			lineItems: [{ description: "Different line", amount: 50 }],
			requestId: "req_booking_1"
		});

		expect(firstRecord[0]).toBeNull();
		expect(firstRecord[1]).toMatchObject({ created: true });
		expect(secondRecord).toEqual([
			null,
			{ created: false, stripeInvoiceRecordId: firstRecord[1]?.stripeInvoiceRecordId }
		]);

		const [error, invoices] = await t
			.withIdentity(adminIdentity)
			.query(api.stripeInvoices.listStripeInvoicesForBooking, { bookingId });

		expect(error).toBeNull();
		expect(invoices).toHaveLength(1);
	});

	test("marks a stored invoice paid once and ignores unknown ids", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const paidAt = now + 60 * 60 * 1000;

		await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_test_booking",
			lineItems: [{ description: "Extra editing", amount: 120 }],
			requestId: "req_booking_1"
		});

		expect(
			await t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
				stripeInvoiceId: "in_test_booking",
				paidAt
			})
		).toEqual([null, { outcome: "completed" }]);
		expect(
			await t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
				stripeInvoiceId: "in_test_booking",
				paidAt: paidAt + 1
			})
		).toEqual([null, { outcome: "already_completed" }]);
		expect(
			await t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
				stripeInvoiceId: "in_test_missing",
				paidAt
			})
		).toEqual([null, { outcome: "not_found" }]);
	});

	test("stores one stripe invoice when a package adjustment invoice is sent", async () => {
		const t = createConvexTest();
		const packageId = await seedPaidPackage(t);

		const adjustmentId = await t.run((ctx) =>
			ctx.db.insert("packageAdjustments", {
				outcome: "invoice_required",
				packageId,
				trigger: "package_expired",
				remotePodcastBookingIds: [],
				quantity: 2,
				rate: 75,
				totalAmount: 150,
				invoiceNumber: "TEST-ADJ-1",
				createdAt: now,
				invoiceDueAt: now + 7 * 24 * 60 * 60 * 1000,
				invoiceEmailStatus: "pending",
				invoiceEmailClaimedAt: now,
				paymentStatus: "unpaid"
			})
		);

		expect(
			await t.mutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
				adjustmentId,
				claimedAt: now,
				stripeInvoiceId: "in_test_adjustment"
			})
		).toEqual([null, { updated: true }]);

		const [error, invoices] = await t
			.withIdentity(adminIdentity)
			.query(api.stripeInvoices.listStripeInvoicesForPackage, { packageId });

		expect(error).toBeNull();
		expect(invoices).toHaveLength(1);
		expect(invoices?.[0]).toMatchObject({
			kind: "package_adjustment",
			packageId,
			packageAdjustmentId: adjustmentId,
			stripeInvoiceId: "in_test_adjustment",
			totalAmount: 150,
			paymentStatus: "unpaid"
		});
	});
});

async function seedBooking(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-09",
			time: "10:00",
			sessionStartAt: now,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status: "confirmed",
			archived: false,
			pendingPaymentCreatedAt: now,
			stripeCustomerId: "cus_test_booking"
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
			archived: false,
			createdAt: now - 30 * 24 * 60 * 60 * 1000,
			invoiceEmailStatus: "sent",
			paidAt: now - 20 * 24 * 60 * 60 * 1000,
			expiresAt: now,
			stripeCustomerId: "cus_test_package"
		})
	);
}
