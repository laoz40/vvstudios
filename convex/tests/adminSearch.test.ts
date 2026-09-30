/**
 * Admin list search integration.
 *
 * 1. email prefix on sessions
 *    Finds bookings by stored email via the email index.
 *
 * 2. unprefixed blob refineSearch
 *    Sets refineSearch when the search index has another page after the first batch.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { buildBookingSearchBlob } from "#convex/lib/adminSearchBlob";
import { createConvexTest } from "#convex/test.setup";

// Convex tests cannot import admin-list-pagination.ts; use the same numItems as ADMIN_SEARCH_PAGE_SIZE (40).
const adminSearchPaginationOpts = { cursor: null, numItems: 40 };

const adminIdentity = { publicMetadata: { role: "admin" } };

describe("admin list search", () => {
	test("email prefix on sessions", async () => {
		const t = createConvexTest();
		const targetEmail = "search-target@example.com";
		const targetId = await seedBooking(t, { name: "Target", email: targetEmail });
		await seedBooking(t, { name: "Other", email: "other@example.com" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: `email:${targetEmail}`
			});

		expect(result.page.map((session) => session._id)).toEqual([targetId]);
	});

	test("unprefixed blob refineSearch", async () => {
		const t = createConvexTest();

		await Promise.all(
			Array.from({ length: 41 }, (_, index) =>
				seedBooking(t, {
					name: `Shared token ${index}`,
					email: `shared-${index}@example.com`,
					searchToken: "sharedtoken"
				})
			)
		);

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: "sharedtoken"
			});

		expect("refineSearch" in result && result.refineSearch).toBe(true);
		expect(result.isDone).toBe(false);
	});

	test("unprefixed blob refineSearch false at search page size", async () => {
		const t = createConvexTest();

		await Promise.all(
			Array.from({ length: 40 }, (_, index) =>
				seedBooking(t, {
					name: `Exact batch ${index}`,
					email: `batch-${index}@example.com`,
					searchToken: "exactbatch"
				})
			)
		);

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: "exactbatch"
			});

		expect("refineSearch" in result && result.refineSearch).toBe(false);
		expect(result.isDone).toBe(true);
	});
});

async function seedBooking(
	t: ReturnType<typeof createConvexTest>,
	args: { name: string; email: string; searchToken?: string }
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) => {
		const bookingFields = {
			name: args.name,
			phone: "0400000000",
			accountName: "Test account",
			email: args.email,
			date: "2099-01-01",
			time: "10:00",
			sessionStartAt: 4_071_268_800_000,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed" as const,
			archived: false,
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id",
			notes: args.searchToken
		};

		return ctx.db.insert("bookings", {
			...bookingFields,
			searchBlob: buildBookingSearchBlob(bookingFields)
		});
	});
}
