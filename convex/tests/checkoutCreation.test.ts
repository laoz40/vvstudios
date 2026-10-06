/**
 * Checkout creation keeps the Stripe checkout and pending record linked.
 *
 * 1. Registered setter boundaries
 *    Session and package ID setters return serializable tuples and persist Stripe IDs.
 *
 * 2. Customer checkout creation
 *    Both public checkout actions return the client secret after saving the Stripe link.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Stripe from "stripe";
import dns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
import { api, internal } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const customer = {
	name: "Checkout customer",
	phone: "0400000000",
	accountName: "Checkout account",
	email: "checkout@example.com",
	duration: "1h",
	addons: [],
	notes: ""
};

const session = { ...customer, date: "2030-01-10", time: "10:00", service: "Table Setup" };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
	vi.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
	syncBuiltinESMExports();
	vi.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation((_method, path) => {
		if (path === "/v1/customers") return Promise.resolve({ id: "cus_checkout" });

		if (path === "/v1/coupons") return Promise.resolve({ id: "coupon_checkout" });

		if (path === "/v1/checkout/sessions") {
			return Promise.resolve({ id: "cs_checkout", client_secret: "checkout_secret" });
		}

		throw new Error(`Unexpected Stripe request: ${path}`);
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	syncBuiltinESMExports();
});

describe("checkout Stripe ID setters", () => {
	test("serializes the session setter result and persists the link", async () => {
		const t = createConvexTest();

		const bookingId = await t.run((ctx) =>
			ctx.db.insert(
				"bookings",
				bookingDocument({
					...session,
					sessionStartAt,
					status: "pending_payment",
					archived: false,
					pendingPaymentCreatedAt: now
				})
			)
		);

		const result = await t.mutation(internal.sessionCheckout.setSessionStripeSessionId, {
			bookingId,
			stripeSessionId: "cs_checkout",
			stripeCustomerId: "cus_checkout"
		});

		const booking = await t.query(internal.sessionCheckout.getSessionByStripeSessionId, {
			stripeSessionId: "cs_checkout"
		});

		expect({ result, bookingId: booking?._id, customerId: booking?.stripeCustomerId }).toEqual({
			result: [null, null],
			bookingId,
			customerId: "cus_checkout"
		});
	});

	test("serializes the package setter result and persists the link", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);

		const result = await t.mutation(internal.packageCheckout.setPackageStripeSessionId, {
			packageId,
			stripeSessionId: "cs_checkout",
			stripeCustomerId: "cus_checkout"
		});

		const packageRecord = await t.query(internal.packageCheckout.getPackageByStripeSessionId, {
			stripeSessionId: "cs_checkout"
		});

		expect({
			result,
			packageId: packageRecord?._id,
			customerId: packageRecord?.stripeCustomerId
		}).toEqual({ result: [null, null], packageId, customerId: "cus_checkout" });
	});
});

describe("customer checkout creation", () => {
	test("returns a session checkout with a saved Stripe link", async () => {
		const t = createConvexTest();
		await seedSettings(t);

		const result = await t.action(api.stripe.createEmbeddedCheckoutSession, session);

		const booking = await t.query(internal.sessionCheckout.getSessionByStripeSessionId, {
			stripeSessionId: "cs_checkout"
		});

		expect({ result, customerId: booking?.stripeCustomerId }).toEqual({
			result: [
				null,
				{ bookingId: booking?._id, clientSecret: "checkout_secret", stripeSessionId: "cs_checkout" }
			],
			customerId: "cus_checkout"
		});
	});

	test("returns a package checkout with a saved Stripe link", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packagePayment.createPackageCheckoutSession, {
			...customer,
			packageSize: 4
		});

		const packageRecord = await t.query(internal.packageCheckout.getPackageByStripeSessionId, {
			stripeSessionId: "cs_checkout"
		});

		expect({ result, customerId: packageRecord?.stripeCustomerId }).toEqual({
			result: [
				null,
				{
					packageId: packageRecord?._id,
					clientSecret: "checkout_secret",
					stripeSessionId: "cs_checkout"
				}
			],
			customerId: "cus_checkout"
		});
	});
});

async function seedPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
				...customer,
				packageSize: 4,
				singleSessionAmount: 100,
				packageSubtotalAmount: 400,
				discountPercent: 10,
				discountAmount: 40,
				totalDueAmount: 360,
				status: "pending_payment",
				archived: false,
				createdAt: now,
				receiptEmailStatus: "pending"
			})
		)
	);
}

async function seedSettings(t: TestClient) {
	await t.run((ctx) =>
		ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 30,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		})
	);
}
