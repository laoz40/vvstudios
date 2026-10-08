/**
 * Admin Stripe invoicing actions require a Stripe customer and persist sent invoices.
 *
 * 1. Booking invoice
 *    Missing booking customers are rejected; a valid customer produces a persisted invoice.
 *
 * 2. Package invoice
 *    Missing package customers are rejected; a valid customer produces a persisted invoice.
 */
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";
import { api } from "#convex/_generated/api";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	vi.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation((method, path) => {
		if (path === "/v1/invoices") return Promise.resolve({ id: "in_admin_draft" });

		if (path === "/v1/invoiceitems") return Promise.resolve({ id: "ii_admin_1" });

		if (path === "/v1/invoices/in_admin_draft/finalize") {
			return Promise.resolve({ id: "in_admin_finalized" });
		}

		if (path === "/v1/invoices/in_admin_finalized/send") {
			return Promise.resolve({ id: "in_admin_finalized" });
		}

		throw new Error(`Unexpected Stripe request: ${method} ${path}`);
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("sendStripeInvoice without stripeCustomerId", () => {
	test("rejects a booking invoice when the booking has no Stripe customer", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
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

		const validBookingId = await seedBooking(t, "cus_booking_valid");

		const validResult = await admin.action(api.stripeInvoicing.sendBookingStripeInvoice, {
			bookingId: validBookingId,
			lineItems: [{ description: "Extra editing", amount: 120 }],
			requestId: "req_booking_valid"
		});

		expect(validResult).toEqual([null, { stripeInvoiceId: "in_admin_finalized" }]);

		const [validError, validInvoices] = await admin.query(
			api.stripeInvoices.listStripeInvoicesForBooking,
			{ bookingId: validBookingId }
		);

		expect(validError).toBeNull();
		expect(validInvoices).toMatchObject([
			{ stripeInvoiceId: "in_admin_finalized", totalAmount: 120, paymentStatus: "unpaid" }
		]);
	});

	test("rejects a package invoice when the package has no Stripe customer", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
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

		const validPackageId = await seedPackage(t, "cus_package_valid");

		const validResult = await admin.action(api.stripeInvoicing.sendPackageStripeInvoice, {
			packageId: validPackageId,
			lineItems: [{ description: "Extra package charge", amount: 80 }],
			requestId: "req_package_valid"
		});

		expect(validResult).toEqual([null, { stripeInvoiceId: "in_admin_finalized" }]);

		const [validError, validInvoices] = await admin.query(
			api.stripeInvoices.listStripeInvoicesForPackage,
			{ packageId: validPackageId }
		);

		expect(validError).toBeNull();
		expect(validInvoices).toMatchObject([
			{ stripeInvoiceId: "in_admin_finalized", totalAmount: 80, paymentStatus: "unpaid" }
		]);
	});
});

async function seedBooking(t: TestClient, stripeCustomerId?: string) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
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
				paymentCompletedAt: now,
				stripeCustomerId
			})
		)
	);
}

async function seedPackage(t: TestClient, stripeCustomerId?: string) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
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
				receiptEmailStatus: "sent",
				paidAt: now,
				stripeCustomerId
			})
		)
	);
}
