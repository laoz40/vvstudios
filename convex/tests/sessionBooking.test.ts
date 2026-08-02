/**
 * These tests cover the customer flow before Stripe reports a successful payment:
 * validating a booking request, creating and linking checkout, and closing an
 * incomplete checkout without affecting the wrong booking.
 *
 * 1. Invalid customer data
 *    Invalid form data must return the stable input error without checking DNS,
 *    creating a booking, or opening a Stripe checkout.
 *
 * 2. Unavailable booking time
 *    Past, too-soon, outside-hours, and too-far-ahead requests must be rejected by
 *    the backend without creating a booking or Stripe checkout.
 *
 * 3. Successful checkout creation
 *    A valid request must create one pending booking, open one Stripe checkout, and
 *    save the Stripe session ID on the same booking.
 *
 * 4. Unexpected Stripe creation failure
 *    Provider rejection must escape the expected business-error channel.
 *
 * 5. Open checkout closure
 *    Closing an open checkout must expire its Stripe session and mark only its linked
 *    pending booking as abandoned.
 *
 * 6. Completed checkout closure
 *    A completed Stripe session must leave its pending booking untouched so payment
 *    completion can continue through the webhook flow.
 *
 * 7. Mismatched checkout closure
 *    A session that does not belong to the supplied booking must not abandon it.
 *
 * 8. Stripe closure failure
 *    Provider rejection while closing must return its stable expected failure.
 *
 * Stripe and DNS are replaced with fakes, so no real provider requests are made.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({
	createCheckoutSession: vi.fn(),
	expireCheckoutSession: vi.fn(),
	resolveMx: vi.fn(),
	retrieveCheckoutSession: vi.fn()
}));

vi.mock("#convex/env", () => ({
	env: {
		GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
		STRIPE_BOOKING_DEPOSIT_PRICE_ID: "price_deposit",
		STRIPE_CHECKOUT_RETURN_URL: "https://example.com/checkout/return",
		STRIPE_PROCESSING_FEE_PRICE_ID: "price_fee",
		STRIPE_SECRET_KEY: "sk_test"
	}
}));

vi.mock("node:dns/promises", () => ({ resolveMx: providerFakes.resolveMx }));

vi.mock("stripe", () => ({
	default: class StripeMock {
		checkout = {
			sessions: {
				create: providerFakes.createCheckoutSession,
				expire: providerFakes.expireCheckoutSession,
				retrieve: providerFakes.retrieveCheckoutSession
			}
		};
	}
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const validBooking = {
	name: "Test Customer",
	phone: "0400000000",
	accountName: "Test Account",
	email: "customer@example.com",
	date: "2030-01-10",
	time: "10:00",
	duration: "1h",
	service: "Table Setup",
	addons: [] as string[],
	notes: ""
};

type TestClient = ReturnType<typeof createConvexTest>;

type AvailabilityCase = {
	label: string;
	request: Partial<typeof validBooking>;
	reason: "BOOKING_OUTSIDE_OPENING_HOURS" | "BOOKING_TOO_FAR_AHEAD" | "BOOKING_TOO_SOON";
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.resolveMx.mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
	providerFakes.createCheckoutSession.mockResolvedValue({
		id: "cs_test_1",
		client_secret: "secret_test_1"
	});
	providerFakes.expireCheckoutSession.mockResolvedValue({});
});

describe("single-session checkout creation", () => {
	test("rejects representative invalid customer data without side effects", async () => {
		const t = createConvexTest();
		await seedBookingSettings(t);

		const result = await t.action(api.stripe.createEmbeddedCheckoutSession, {
			...validBooking,
			email: "not-an-email"
		});

		expect(result).toEqual([{ reason: "BOOKING_INVALID_INPUT" }, null]);
		expect(await listBookings(t)).toEqual([]);
		expect(providerFakes.resolveMx).not.toHaveBeenCalled();
		expect(providerFakes.createCheckoutSession).not.toHaveBeenCalled();
	});

	const unavailableCases: AvailabilityCase[] = [
		{
			label: "past time",
			request: { date: "2029-12-31", time: "10:00" },
			reason: "BOOKING_TOO_SOON"
		},
		{
			label: "inside the lead-time window",
			request: { date: "2030-01-01", time: "10:00" },
			reason: "BOOKING_TOO_SOON"
		},
		{
			label: "outside opening hours",
			request: { time: "08:00" },
			reason: "BOOKING_OUTSIDE_OPENING_HOURS"
		},
		{
			label: "beyond the booking horizon",
			request: { date: "2030-02-15", time: "10:00" },
			reason: "BOOKING_TOO_FAR_AHEAD"
		}
	];

	test.each(unavailableCases)(
		"rejects $label before creating a booking or Stripe session",
		async ({ request, reason }) => {
			const t = createConvexTest();
			await seedBookingSettings(t);

			const result = await t.action(api.stripe.createEmbeddedCheckoutSession, {
				...validBooking,
				...request
			});

			expect(result).toEqual([{ reason }, null]);
			expect(await listBookings(t)).toEqual([]);
			expect(providerFakes.createCheckoutSession).not.toHaveBeenCalled();
		}
	);

	test("creates one pending booking and links it to the Stripe checkout", async () => {
		const t = createConvexTest();
		await seedBookingSettings(t);

		const result = await t.action(api.stripe.createEmbeddedCheckoutSession, validBooking);
		const bookings = await listBookings(t);

		expect(result).toMatchObject([
			null,
			{ clientSecret: "secret_test_1", stripeSessionId: "cs_test_1" }
		]);
		expect(bookings).toHaveLength(1);
		expect(bookings[0]).toMatchObject({
			name: validBooking.name,
			email: validBooking.email,
			date: validBooking.date,
			time: validBooking.time,
			duration: validBooking.duration,
			service: validBooking.service,
			addons: validBooking.addons,
			status: "pending_payment",
			stripeSessionId: "cs_test_1"
		});
		expect(providerFakes.createCheckoutSession).toHaveBeenCalledTimes(1);
		expect(providerFakes.createCheckoutSession).toHaveBeenCalledWith(
			expect.objectContaining({
				customer_email: validBooking.email,
				metadata: { bookingId: bookings[0]?._id }
			})
		);
	});

	test("allows an unexpected Stripe creation failure to reject", async () => {
		const t = createConvexTest();
		await seedBookingSettings(t);
		providerFakes.createCheckoutSession.mockRejectedValue(new Error("Stripe unavailable"));

		await expect(t.action(api.stripe.createEmbeddedCheckoutSession, validBooking)).rejects.toThrow(
			"Stripe unavailable"
		);
	});
});

describe("single-session checkout closure", () => {
	test("expires an open session and abandons only its matching pending booking", async () => {
		const t = createConvexTest();
		const bookingId = await seedPendingBooking(t, "cs_open");
		providerFakes.retrieveCheckoutSession.mockResolvedValue({ status: "open" });

		const result = await t.action(api.stripe.closeEmbeddedCheckoutSession, {
			bookingId,
			stripeSessionId: "cs_open"
		});

		expect(result).toEqual([null, { outcome: "abandoned" }]);
		expect(providerFakes.expireCheckoutSession).toHaveBeenCalledWith("cs_open");
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "abandoned" });
	});

	test("does not abandon a completed checkout", async () => {
		const t = createConvexTest();
		const bookingId = await seedPendingBooking(t, "cs_complete");
		providerFakes.retrieveCheckoutSession.mockResolvedValue({ status: "complete" });

		const result = await t.action(api.stripe.closeEmbeddedCheckoutSession, {
			bookingId,
			stripeSessionId: "cs_complete"
		});

		expect(result).toEqual([null, { outcome: "already_complete" }]);
		expect(providerFakes.expireCheckoutSession).not.toHaveBeenCalled();
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "pending_payment" });
	});

	test("does not abandon a booking owned by another Stripe session", async () => {
		const t = createConvexTest();
		const bookingId = await seedPendingBooking(t, "cs_owner");
		providerFakes.retrieveCheckoutSession.mockResolvedValue({ status: "expired" });

		const result = await t.action(api.stripe.closeEmbeddedCheckoutSession, {
			bookingId,
			stripeSessionId: "cs_other"
		});

		expect(result).toEqual([{ reason: "STRIPE_SESSION_MISMATCH" }, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "pending_payment" });
	});

	test("returns the expected close failure when Stripe rejects", async () => {
		const t = createConvexTest();
		const bookingId = await seedPendingBooking(t, "cs_unavailable");
		providerFakes.retrieveCheckoutSession.mockRejectedValue(new Error("Stripe unavailable"));

		const result = await t.action(api.stripe.closeEmbeddedCheckoutSession, {
			bookingId,
			stripeSessionId: "cs_unavailable"
		});

		expect(result).toEqual([{ reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "pending_payment" });
	});
});

async function seedBookingSettings(t: TestClient) {
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

async function seedPendingBooking(t: TestClient, stripeSessionId: string) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			...validBooking,
			sessionStartAt: Date.parse("2030-01-09T23:00:00.000Z"),
			status: "pending_payment",
			pendingPaymentCreatedAt: now,
			stripeSessionId
		})
	);
}

async function listBookings(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("bookings").take(10));
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
