/**
 * Strip phoneNormalized integration.
 *
 * 1. stripBookingPhoneNormalized
 *    Removes phoneNormalized from legacy booking rows.
 */
import { describe, expect, test } from "vitest";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

describe("strip phoneNormalized", () => {
	test("stripBookingPhoneNormalized clears phoneNormalized on legacy rows", async () => {
		const t = createConvexTest();
		const bookingId = await seedLegacyBookingWithPhoneNormalized(t);

		const firstBatch = await t.mutation(internal.stripPhoneNormalized.stripBookingPhoneNormalized, {
			cursor: null
		});

		expect(firstBatch.stripped).toBe(1);

		const booking = await t.run((ctx) => ctx.db.get("bookings", bookingId));

		expect(booking?.phoneNormalized).toBeUndefined();
	});
});

async function seedLegacyBookingWithPhoneNormalized(
	t: ReturnType<typeof createConvexTest>
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) => {
		const paymentCompletedAt = 1_704_067_200_000;

		return ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Legacy booking",
				phone: "0400111222",
				accountName: "Legacy account",
				email: "legacy@example.com",
				date: "2099-06-01",
				time: "10:00",
				sessionStartAt: 4_071_268_800_000,
				duration: "1 hour",
				service: "Remote Podcast",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: paymentCompletedAt,
				paymentCompletedAt,
				googleEventId: "event-id",
				googleCalendarId: "calendar-id",
				phoneNormalized: "0400111222"
			})
		);
	});
}
