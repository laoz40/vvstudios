/**
 * Admin search backfill integration.
 *
 * 1. backfillBookingAdminSearch
 *    Fills searchBlob, phoneNormalized, and receipt on legacy bookings.
 *
 * 2. receiptNumberForPaidBooking
 *    Copies package receipt numbers onto package session bookings.
 */
import { describe, expect, test } from "vitest";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { receiptNumberForPaidBooking } from "#convex/lib/adminSearchBackfill";
import { normalizePhone } from "#convex/lib/contactNormalization";
import { createConvexTest } from "#convex/test.setup";

describe("admin search backfill", () => {
	test("backfillBookingAdminSearch fills phoneNormalized and searchBlob on legacy rows", async () => {
		const t = createConvexTest();
		const bookingId = await seedLegacyBooking(t, { phone: "+61 400 111 222" });

		const firstBatch = await t.mutation(internal.adminSearchBackfill.backfillBookingAdminSearch, {
			cursor: null
		});

		expect(firstBatch.patched).toBe(1);

		const booking = await t.run((ctx) => ctx.db.get("bookings", bookingId));

		expect(booking?.phoneNormalized).toBe(normalizePhone("+61 400 111 222"));
		expect(booking?.searchBlob).toContain("0400111222");
		expect(booking?.receiptNumber).toBeUndefined();
	});

	test("receiptNumberForPaidBooking copies package receipt for paid package sessions", async () => {
		const t = createConvexTest();

		const receiptNumber = await t.run(async (ctx) => {
			const packageId = await ctx.db.insert(
				"packages",
				packageDocument({
					name: "Package",
					phone: "0400000000",
					accountName: "Account",
					email: "pkg@example.com",
					duration: "1 hour",
					addons: [],
					packageSize: 4,
					singleSessionAmount: 100,
					packageSubtotalAmount: 400,
					discountPercent: 0,
					discountAmount: 0,
					totalDueAmount: 400,
					createdAt: 1,
					paidAt: 2,
					status: "paid",
					archived: false,
					receiptNumber: "VV-PKG-SESSION"
				})
			);

			const booking = await ctx.db.get(
				"bookings",
				await ctx.db.insert(
					"bookings",
					bookingDocument({
						name: "Session",
						phone: "0400000000",
						accountName: "Account",
						email: "session@example.com",
						date: "2099-06-01",
						time: "10:00",
						sessionStartAt: 4_071_268_800_000,
						duration: "1 hour",
						service: "Remote Podcast",
						addons: [],
						status: "confirmed",
						archived: false,
						pendingPaymentCreatedAt: 1,
						paymentCompletedAt: 2,
						packageId,
						googleEventId: "event-id",
						googleCalendarId: "calendar-id"
					})
				)
			);

			if (booking === null) {
				throw new Error("booking missing");
			}

			return receiptNumberForPaidBooking(ctx, booking);
		});

		expect(receiptNumber).toBe("VV-PKG-SESSION");
	});
});

async function seedLegacyBooking(
	t: ReturnType<typeof createConvexTest>,
	args: { phone: string }
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) => {
		const paymentCompletedAt = 1_704_067_200_000;

		return ctx.db.insert("bookings", {
			name: "Legacy booking",
			phone: args.phone,
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
			searchBlob: ""
		});
	});
}
