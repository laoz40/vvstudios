/**
 * Admin Stripe invoicing actions reject legacy records without a Stripe customer.
 *
 * 1. Booking invoice
 *    Sending a booking invoice without stripeCustomerId fails before Stripe is called.
 *
 * 2. Package invoice
 *    Sending a package invoice without stripeCustomerId fails before Stripe is called.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
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

describe("sendStripeInvoice without stripeCustomerId", () => {
	test("rejects a booking invoice when the booking has no Stripe customer", async () => {
		const t = createConvexTest();
		const bookingId = await seedBookingWithoutStripeCustomer(t);
		const admin = t.withIdentity(adminIdentity);

		const result = await admin.action(api.stripeInvoicing.sendBookingStripeInvoice, {
			bookingId,
			lineItems: [{ description: "Extra editing", amount: 120 }],
			requestId: "req_booking_missing_customer"
		});

		expect(result).toEqual([{ reason: "STRIPE_CUSTOMER_NOT_FOUND" }, null]);

		const [error, invoices] = await admin.query(api.stripeInvoices.listStripeInvoicesForBooking, {
			bookingId
		});

		expect(error).toBeNull();
		expect(invoices).toEqual([]);
	});

	test("rejects a package invoice when the package has no Stripe customer", async () => {
		const t = createConvexTest();
		const packageId = await seedPackageWithoutStripeCustomer(t);
		const admin = t.withIdentity(adminIdentity);

		const result = await admin.action(api.stripeInvoicing.sendPackageStripeInvoice, {
			packageId,
			lineItems: [{ description: "Extra package charge", amount: 80 }],
			requestId: "req_package_missing_customer"
		});

		expect(result).toEqual([{ reason: "STRIPE_CUSTOMER_NOT_FOUND" }, null]);

		const [error, invoices] = await admin.query(api.stripeInvoices.listStripeInvoicesForPackage, {
			packageId
		});

		expect(error).toBeNull();
		expect(invoices).toEqual([]);
	});
});

async function seedBookingWithoutStripeCustomer(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Legacy customer",
			phone: "0400000000",
			accountName: "Legacy account",
			email: "legacy@example.com",
			date: "2030-01-20",
			time: "10:00",
			sessionStartAt: now,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status: "confirmed",
			archived: false,
			pendingPaymentCreatedAt: now,
			paymentCompletedAt: now
		})
	);
}

async function seedPackageWithoutStripeCustomer(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Legacy package customer",
			phone: "0400000000",
			accountName: "Legacy package account",
			email: "legacy-package@example.com",
			duration: "1h",
			addons: [] satisfies BookingAddon[],
			packageSize: 4,
			singleSessionAmount: 200,
			packageSubtotalAmount: 800,
			discountPercent: 5,
			discountAmount: 40,
			totalDueAmount: 760,
			status: "paid",
			archived: false,
			createdAt: now,
			invoiceEmailStatus: "sent",
			paidAt: now
		})
	);
}
