/**
 * Admin sessions list views.
 *
 * 1. Inbox list
 *    Returns only unarchived bookings.
 *
 * 2. All sessions list
 *    Returns archived and unarchived bookings.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const paginationOpts = { cursor: null, numItems: 50 };

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

describe("listSessions admin views", () => {
	test("inbox omits archived bookings", async () => {
		const t = createConvexTest();
		const visibleId = await seedBooking(t, "Inbox Visible");
		const archivedId = await seedBooking(t, "Inbox Hidden");
		await t.run((ctx) => ctx.db.patch(archivedId, { hiddenAt: Date.now() }));

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, { paginationOpts, view: "inbox" });

		const ids = result.page.map((session) => session._id);
		expect(ids).toContain(visibleId);
		expect(ids).not.toContain(archivedId);
	});

	test("all sessions includes archived bookings", async () => {
		const t = createConvexTest();
		const archivedId = await seedBooking(t, "All Tab Archived");
		await t.run((ctx) => ctx.db.patch(archivedId, { hiddenAt: Date.now() }));

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, { paginationOpts, view: "all" });

		expect(result.page.map((session) => session._id)).toContain(archivedId);
	});
});

async function seedBooking(t: TestClient, name: string): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name,
			phone: "0400000000",
			accountName: "Test account",
			email: `${name.replaceAll(" ", "-").toLowerCase()}@example.com`,
			date: "2099-01-01",
			time: "10:00",
			sessionStartAt: 4_071_268_800_000,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id"
		})
	);
}
