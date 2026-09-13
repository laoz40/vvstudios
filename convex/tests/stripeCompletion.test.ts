/**
 * These tests cover booking confirmation claim idempotency and recoverable failure guards.
 *
 * 1. First claim wins
 *    Calling the payment claim twice must keep the first Stripe event details.
 *
 * 2. Stale confirmation failure
 *    A delayed confirmation failure must not regress a booking that already reached a later state.
 *
 * 3. Invoice email failure status guard
 *    Email failures may only move confirmed bookings into the recoverable email-failed state.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const bookingDate = "2030-01-10";

const bookingTime = "10:00";

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
});

describe("booking payment completion", () => {
	test("claims a Stripe completion once without overwriting the first claim", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const firstClaim = await claimBooking(t, bookingId, "evt-first");
		const claimedBooking = await readBooking(t, bookingId);
		const duplicateClaim = await claimBooking(t, bookingId, "evt-duplicate");
		const replayedClaim = await claimBooking(t, bookingId, "evt-first");

		expect(firstClaim).toMatchObject([null, { outcome: "claimed" }]);
		expect(duplicateClaim).toEqual([null, { outcome: "already_claimed" }]);
		expect(replayedClaim).toEqual([null, { outcome: "already_claimed" }]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			bookingConfirmationClaimedAt: claimedBooking?.bookingConfirmationClaimedAt,
			bookingConfirmationEventId: "evt-first",
			paymentCompletedAt: claimedBooking?.paymentCompletedAt,
			stripePaymentIntentId: "pi-1",
			stripeSessionId: "cs-1"
		});
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
