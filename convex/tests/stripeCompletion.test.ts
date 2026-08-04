/**
 * These tests cover what happens after Stripe reports a successful payment:
 * the booking is claimed, its time is reserved, a Google Calendar event is created,
 * and invoice emails are sent.
 *
 * 1. First claim wins
 *    Calling the payment claim twice must keep the first Stripe event details.
 *    This protects the booking when Stripe sends duplicate webhooks.
 *
 * 2. Completion runs once
 *    Completing the same booking twice must create only one calendar event and email.
 *
 * 3. Time became unavailable
 *    If Google Calendar now contains a conflicting event, the booking must fail without
 *    creating a calendar event or sending an email.
 *
 * 4. Calendar creation failure
 *    A Google Calendar failure must leave the booking in a recoverable failed state and
 *    must not send confirmation or invoice emails.
 *
 * 5. Two customers paid for the same time
 *    Both completions run together. Only one booking may be confirmed, which proves the
 *    database reservation prevents double-booking.
 *
 * 6. Invalid Stripe webhook
 *    Requests with a missing or invalid signature must be rejected without changing data.
 *
 * 7. Valid Stripe webhook replay
 *    The first request confirms the booking. Repeating it must return success without
 *    creating another calendar event or email.
 *
 * 8. Stale confirmation failure
 *    A delayed confirmation failure must not regress a booking that already reached a later state.
 *
 * 9. Invoice email failure status guard
 *    Email failures may only move confirmed bookings into the recoverable email-failed state.
 *
 * 10. Missing booking metadata
 *     Completed checkouts without a booking ID must return 400.
 *
 * 11. Expected claim failures
 *     Invalid booking claims must be acknowledged with the stable "claim failed" response.
 *
 * 12. Already-claimed checkout
 *     A completion already being processed must be acknowledged without repeating provider work.
 *
 * 13. Expected completion failures
 *     Completion errors must be acknowledged with the stable "completion failed" response.
 *
 * 14. Non-completed completion outcomes
 *     Safe terminal outcomes must be returned directly with status 200.
 *
 * 15. Expired checkout
 *     Expiration events must update the booking and return the stable "expired" response.
 *
 * 16. Unsupported Stripe event
 *     Events outside the supported checkout lifecycle must be ignored with status 200.
 *
 * 17. Unexpected Convex rejection
 *     Unexpected internal failures must reject the request so Stripe can retry it.
 *
 * Stripe, Google Calendar, and email are replaced with fakes, so no real requests are made.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ok, okAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({
	insertEvent: vi.fn(),
	listEvents: vi.fn(),
	sendInvoiceEmails: vi.fn(),
	verifyStripeWebhook: vi.fn()
}));

vi.mock("#convex/env", () => ({
	env: { STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test" }
}));

vi.mock("#convex/lib/googleCalendarClient", () => ({
	getGoogleCalendarClient: () => ({
		calendarId: "primary-calendar",
		calendarIds: ["primary-calendar"],
		timeZone: "Australia/Sydney",
		calendar: { events: { insert: providerFakes.insertEvent, list: providerFakes.listEvents } }
	})
}));

vi.mock("#convex/lib/email", () => ({
	sendBookingInvoiceEmailsForBooking: providerFakes.sendInvoiceEmails
}));

vi.mock("#convex/lib/sessionRescheduleLinks", () => ({
	createRescheduleUrlForSession: vi.fn(() => okAsync("https://example.com/reschedule/test-token"))
}));

vi.mock("stripe", () => ({
	default: class StripeMock {
		webhooks = { constructEventAsync: providerFakes.verifyStripeWebhook };
	}
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");
const bookingDate = "2030-01-10";
const bookingTime = "10:00";

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.listEvents.mockResolvedValue({ data: { items: [] } });
	providerFakes.insertEvent.mockResolvedValue({ data: { id: "google-event-1" } });
	providerFakes.sendInvoiceEmails.mockResolvedValue(ok(null));
});

describe("booking payment completion", () => {
	test("claims a Stripe completion once without overwriting the first claim", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const firstClaim = await claimBooking(t, bookingId, "evt-first");
		const claimedBooking = await readBooking(t, bookingId);
		const duplicateClaim = await claimBooking(t, bookingId, "evt-duplicate");

		expect(firstClaim).toMatchObject([null, { outcome: "claimed" }]);
		expect(duplicateClaim).toEqual([null, { outcome: "already_claimed" }]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			bookingConfirmationClaimedAt: claimedBooking?.bookingConfirmationClaimedAt,
			bookingConfirmationEventId: "evt-first",
			paymentCompletedAt: claimedBooking?.paymentCompletedAt,
			stripePaymentIntentId: "pi-1",
			stripeSessionId: "cs-1"
		});
	});

	test("confirms a paid booking and performs provider work once", async () => {
		const t = createConvexTest();
		const bookingId = await seedClaimedBooking(t);

		const firstCompletion = await t.action(internal.googleCalendar.completeClaimedSession, {
			bookingId
		});
		const replayedCompletion = await t.action(internal.googleCalendar.completeClaimedSession, {
			bookingId
		});

		expect(firstCompletion).toEqual([null, { outcome: "completed" }]);
		expect(replayedCompletion).toEqual([null, { outcome: "already_completed" }]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			status: "confirmed",
			googleCalendarId: "primary-calendar",
			googleEventId: "google-event-1"
		});
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledTimes(1);
	});

	test("fails safely when the time becomes unavailable during checkout", async () => {
		const t = createConvexTest();
		const bookingId = await seedClaimedBooking(t);
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "existing-event",
						start: { dateTime: "2030-01-09T23:00:00.000Z" },
						end: { dateTime: "2030-01-10T00:00:00.000Z" }
					}
				]
			}
		});

		const result = await t.action(internal.googleCalendar.completeClaimedSession, { bookingId });

		expect(result).toEqual([null, { outcome: "booking_time_unavailable" }]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			status: "failed",
			bookingFailureCode: "BOOKING_TIME_UNAVAILABLE"
		});
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
		expect(providerFakes.sendInvoiceEmails).not.toHaveBeenCalled();
	});

	test("records a recoverable failure when Calendar event creation fails", async () => {
		const t = createConvexTest();
		const bookingId = await seedClaimedBooking(t);
		providerFakes.insertEvent.mockRejectedValue(new Error("Google Calendar unavailable"));

		const result = await t.action(internal.googleCalendar.completeClaimedSession, { bookingId });

		expect(result).toEqual([null, { outcome: "google_calendar_create_failed" }]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			status: "failed",
			bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED"
		});
		expect(providerFakes.sendInvoiceEmails).not.toHaveBeenCalled();
	});

	test("ignores a stale confirmation failure after the booking has moved on", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		await t.run((ctx) =>
			ctx.db.patch(bookingId, { status: "confirmed", bookingFailureCode: undefined })
		);

		const result = await t.mutation(internal.bookingConfirmation.markBookingConfirmationFailed, {
			bookingId,
			failureCode: "GOOGLE_CALENDAR_CREATE_FAILED"
		});

		expect(result).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "confirmed" });
	});

	test("only records an invoice email failure for a confirmed booking", async () => {
		const t = createConvexTest();
		const confirmedBookingId = await seedBooking(t, "confirmed@example.com");
		const cancelledBookingId = await seedBooking(t, "cancelled@example.com");
		await t.run(async (ctx) => {
			await ctx.db.patch(confirmedBookingId, { status: "confirmed" });
			await ctx.db.patch(cancelledBookingId, { status: "cancelled" });
		});

		const confirmedResult = await t.mutation(
			internal.bookingConfirmation.markSessionInvoiceEmailFailed,
			{ bookingId: confirmedBookingId }
		);
		const cancelledResult = await t.mutation(
			internal.bookingConfirmation.markSessionInvoiceEmailFailed,
			{ bookingId: cancelledBookingId }
		);

		expect(confirmedResult).toEqual([null, null]);
		expect(cancelledResult).toEqual([null, null]);
		expect(await readBooking(t, confirmedBookingId)).toMatchObject({
			status: "email_failed",
			bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
		});
		expect(await readBooking(t, cancelledBookingId)).toMatchObject({ status: "cancelled" });
	});

	test("allows only one concurrent completion for the same time", async () => {
		const t = createConvexTest();
		const [firstBookingId, secondBookingId] = await Promise.all([
			seedClaimedBooking(t, "first@example.com"),
			seedClaimedBooking(t, "second@example.com")
		]);
		let availabilityChecks = 0;
		let releaseChecks: (() => void) | undefined;
		const bothChecking = new Promise<void>((resolve) => {
			releaseChecks = resolve;
		});
		providerFakes.listEvents.mockImplementation(async () => {
			availabilityChecks += 1;
			if (availabilityChecks === 2) releaseChecks?.();
			await bothChecking;
			return { data: { items: [] } };
		});

		const results = await Promise.all([
			t.action(internal.googleCalendar.completeClaimedSession, { bookingId: firstBookingId }),
			t.action(internal.googleCalendar.completeClaimedSession, { bookingId: secondBookingId })
		]);
		const bookings = await Promise.all([
			readBooking(t, firstBookingId),
			readBooking(t, secondBookingId)
		]);

		expect(results).toContainEqual([null, { outcome: "completed" }]);
		expect(results).toContainEqual([null, { outcome: "booking_time_unavailable" }]);
		expect(bookings.filter((booking) => booking?.status === "confirmed")).toHaveLength(1);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledTimes(1);
	});
});

describe("Stripe completion webhook", () => {
	test("rejects missing and invalid signatures without changing the booking", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.verifyStripeWebhook.mockRejectedValue(new Error("invalid signature"));

		const missingSignature = await t.fetch("/stripe/webhook", { method: "POST", body: "{}" });
		const invalidSignature = await t.fetch("/stripe/webhook", {
			method: "POST",
			headers: { "stripe-signature": "invalid" },
			body: "{}"
		});

		expect(missingSignature.status).toBe(400);
		expect(invalidSignature.status).toBe(400);
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "pending_payment" });
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("accepts a valid event and ignores its replay", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent(bookingId));
		const request = { method: "POST", headers: { "stripe-signature": "valid" }, body: "{}" };

		const firstResponse = await t.fetch("/stripe/webhook", request);
		const replayResponse = await t.fetch("/stripe/webhook", request);

		expect(firstResponse.status).toBe(200);
		expect(await firstResponse.text()).toBe("confirmed");
		expect(replayResponse.status).toBe(200);
		expect(await replayResponse.text()).toBe("already confirmed");
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "confirmed" });
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledTimes(1);
	});

	test("rejects a completed checkout without booking metadata", async () => {
		const t = createConvexTest();
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent());

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Missing bookingId metadata");
	});

	test("acknowledges an expected claim error", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		await t.run((ctx) => ctx.db.patch(bookingId, { status: "expired" }));
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent(bookingId));

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("claim failed");
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("acknowledges a checkout whose booking is already claimed", async () => {
		const t = createConvexTest();
		const bookingId = await seedClaimedBooking(t);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent(bookingId));

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("already claimed");
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("acknowledges an expected completion error", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent(bookingId));
		providerFakes.listEvents.mockImplementation(async () => {
			await t.run((ctx) => ctx.db.delete(bookingId));
			return { data: { items: [] } };
		});

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("completion failed");
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("returns a safe non-completed outcome", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeCompletionEvent(bookingId));
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "existing-event",
						start: { dateTime: "2030-01-09T23:00:00.000Z" },
						end: { dateTime: "2030-01-10T00:00:00.000Z" }
					}
				]
			}
		});

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("booking_time_unavailable");
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "failed" });
	});

	test("expires a pending booking from a checkout expiration event", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeExpirationEvent("cs-1"));

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("expired");
		expect(await readBooking(t, bookingId)).toMatchObject({ status: "expired" });
	});

	test("acknowledges an unsupported Stripe event as ignored", async () => {
		const t = createConvexTest();
		providerFakes.verifyStripeWebhook.mockResolvedValue({
			id: "evt-ignored",
			type: "customer.created",
			data: { object: {} }
		});

		const response = await fetchStripeWebhook(t);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ignored");
	});

	test("lets unexpected Convex rejections escape for Stripe retry", async () => {
		const t = createConvexTest();
		await Promise.all([seedBooking(t, "first@example.com"), seedBooking(t, "second@example.com")]);
		providerFakes.verifyStripeWebhook.mockResolvedValue(stripeExpirationEvent("cs-1"));

		await expect(fetchStripeWebhook(t)).rejects.toThrow();
	});
});

async function seedBooking(t: TestClient, email = "customer@example.com") {
	return await t.run(async (ctx) => {
		await ensureBookingSettings(ctx);
		return await ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email,
			date: bookingDate,
			time: bookingTime,
			sessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "pending_payment",
			pendingPaymentCreatedAt: now,
			stripeSessionId: "cs-1"
		});
	});
}

async function seedClaimedBooking(t: TestClient, email?: string) {
	const bookingId = await seedBooking(t, email);
	await claimBooking(t, bookingId, `evt-${bookingId}`);
	return bookingId;
}

async function claimBooking(t: TestClient, bookingId: Id<"bookings">, stripeEventId: string) {
	return await t.mutation(internal.bookingConfirmation.claimBookingConfirmation, {
		bookingId,
		stripeSessionId: "cs-1",
		stripePaymentIntentId: "pi-1",
		stripeEventId
	});
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}

async function ensureBookingSettings(ctx: Parameters<Parameters<TestClient["run"]>[0]>[0]) {
	const existing = await ctx.db
		.query("bookingSettings")
		.withIndex("by_key", (query) => query.eq("key", "main"))
		.unique();
	if (existing) return;

	await ctx.db.insert("bookingSettings", {
		key: "main",
		leadTimeMinutes: 60,
		eventBufferMinutes: 15,
		maxDaysAhead: 30,
		weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
		updatedAt: now
	});
}

function fetchStripeWebhook(t: TestClient) {
	return t.fetch("/stripe/webhook", {
		method: "POST",
		headers: { "stripe-signature": "valid" },
		body: "{}"
	});
}

function stripeCompletionEvent(bookingId?: Id<"bookings">) {
	return {
		id: "evt-webhook",
		type: "checkout.session.completed",
		data: {
			object: { id: "cs-1", metadata: bookingId ? { bookingId } : {}, payment_intent: "pi-1" }
		}
	};
}

function stripeExpirationEvent(stripeSessionId: string) {
	return {
		id: "evt-expired",
		type: "checkout.session.expired",
		data: { object: { id: stripeSessionId } }
	};
}
