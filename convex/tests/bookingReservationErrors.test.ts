/**
 * Booking reservation adapters distinguish missing bookings from busy slots.
 *
 * 1. Missing booking
 *    A real reservation mutation error survives the action boundary unchanged.
 *
 * 2. Busy slot
 *    An actual overlap remains a successful unavailability outcome.
 */
import { describe, expect, test } from "vitest";
import { tupleErr, tupleOk } from "#/lib/result";
import { reserveClaimedBookingSession } from "#convex/booking/lib/confirmationActionBoundaries";
import { createConvexTest } from "#convex/test.setup";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

describe("booking reservation action boundary", () => {
	test("returns BOOKING_NOT_FOUND instead of claiming the slot is busy", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, "pending_payment");
		await t.run((ctx) => ctx.db.delete("bookings", bookingId));

		const result = await t.action(
			async (ctx) =>
				await reserveClaimedBookingSession(ctx, {
					bookingId,
					duration: "1h",
					sessionStartAt,
					eventBufferMinutes: 15
				}).match(tupleOk, tupleErr)
		);

		expect(result).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
	});

	test("reports a confirmed overlapping booking as unavailable", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, "pending_payment");
		await seedBooking(t, "confirmed");

		const result = await t.action(
			async (ctx) =>
				await reserveClaimedBookingSession(ctx, {
					bookingId,
					duration: "1h",
					sessionStartAt,
					eventBufferMinutes: 15
				}).match(tupleOk, tupleErr)
		);

		expect(result).toEqual([null, { outcome: "unavailable" }]);
	});
});

async function seedBooking(t: TestClient, status: "pending_payment" | "confirmed") {
	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Reservation customer",
				phone: "0400000000",
				accountName: "Reservation account",
				email: "customer@example.com",
				date: "2030-01-10",
				time: "10:00",
				duration: "1h",
				service: "Table Setup",
				addons: [],
				sessionStartAt,
				status,
				archived: false,
				pendingPaymentCreatedAt: now
			})
		)
	);
}
