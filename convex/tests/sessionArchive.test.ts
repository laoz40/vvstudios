/**
 * Session auto-archive integration.
 *
 * 1. Deliverables sent
 *    updateSessionEditStatus to completed archives a past confirmed session when invoices are paid.
 *
 * 2. Dead checkout status
 *    Admin delete event and checkout expiry set archived; failed confirmation does not.
 *
 * 3. New unpaid invoice
 *    Recording a booking invoice unarchives confirmed archived sessions only.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const pastSessionStartAt = Date.parse("2029-12-01T10:00:00.000Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("session auto-archive", () => {
	test("archives when deliverables are marked sent on a finished session", async () => {
		const t = createConvexTest();
		const bookingId = await seedPastConfirmedBooking(t);

		const [error] = await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.updateSessionEditStatus, { bookingId, editStatus: "completed" });

		expect(error).toBeNull();
		expect(await readBooking(t, bookingId)).toMatchObject({ archived: true });
	});

	test("archives when admin deletes calendar event", async () => {
		const t = createConvexTest();
		const bookingId = await seedPastConfirmedBooking(t);

		await t.mutation(internal.sessions.markSessionCalendarEventDeleted, { bookingId });

		expect(await readBooking(t, bookingId)).toMatchObject({ status: "cancelled", archived: true });
	});

	test("does not archive failed confirmation bookings", async () => {
		const t = createConvexTest();
		const bookingId = await seedPendingBooking(t, "cs_failed");

		await t.mutation(internal.bookingConfirmation.markBookingConfirmationFailed, {
			bookingId,
			failureCode: "BOOKING_TIME_UNAVAILABLE"
		});

		expect(await readBooking(t, bookingId)).toMatchObject({ status: "failed" });
		expect((await readBooking(t, bookingId))?.archived).toBe(false);
	});

	test("unarchives archived confirmed session when a new unpaid invoice is recorded", async () => {
		const t = createConvexTest();
		const bookingId = await seedPastConfirmedBooking(t, { archived: true });

		await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_unarchive_test",
			lineItems: [{ description: "Extra", amount: 80 }],
			requestId: "req_unarchive"
		});

		const booking = await readBooking(t, bookingId);
		expect(booking?.archived).toBe(false);
	});

	test("archives after the last booking invoice is marked paid on a sent session", async () => {
		const t = createConvexTest();
		const bookingId = await seedPastConfirmedBooking(t, { editStatus: "completed" });

		await t.mutation(internal.stripeInvoices.recordBookingStripeInvoice, {
			bookingId,
			stripeInvoiceId: "in_paid_archive",
			lineItems: [{ description: "Extra", amount: 80 }],
			requestId: "req_paid_archive"
		});

		await t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
			stripeInvoiceId: "in_paid_archive",
			paidAt: now
		});

		expect(await readBooking(t, bookingId)).toMatchObject({ archived: true });
	});
});

async function seedPastConfirmedBooking(
	t: TestClient,
	overrides: Partial<Doc<"bookings">> = {}
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name: "Past Session",
			phone: "0400000000",
			accountName: "Test account",
			email: "past@example.com",
			date: "2029-12-01",
			time: "10:00",
			sessionStartAt: pastSessionStartAt,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			archived: false,
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id",
			...overrides
		})
	);
}

async function seedPendingBooking(t: TestClient, stripeSessionId: string): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name: "Pending",
			phone: "0400000000",
			accountName: "Test account",
			email: "pending@example.com",
			date: "2099-01-01",
			time: "10:00",
			sessionStartAt: Date.parse("2099-01-01T10:00:00.000Z"),
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "pending_payment",
			archived: false,
			pendingPaymentCreatedAt: 1,
			stripeSessionId
		})
	);
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
