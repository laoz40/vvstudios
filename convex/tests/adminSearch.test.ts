/**
 * Admin list search integration.
 *
 * 1. email prefix on sessions
 *    Finds bookings by stored email via the email index.
 *
 * 2. unprefixed blob refineSearch
 *    Sets refineSearch when the search index has another page after the first batch.
 *
 * 3. date prefix on sessions
 *    Finds bookings by session day using AU day/month syntax.
 *
 * 4. receipt prefix on sessions
 *    Finds bookings by receipt number via the receipt index.
 *
 * 5. search cursor continuation
 *    Reads every match once across bounded pages and resets for a different query.
 *
 * 6. ordinary list cursor continuation
 *    Keeps the requested server ordering across pages.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { buildBookingSearchBlob } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { normalizePhone } from "#convex/shared/lib/contactNormalization";
import { createConvexTest } from "#convex/test.setup";

// Convex tests cannot import admin-list-pagination.ts; use the same numItems as ADMIN_SEARCH_PAGE_SIZE (40).
const adminSearchPaginationOpts = { cursor: null, numItems: 40 };

const adminIdentity = { publicMetadata: { role: "admin" } };

describe("admin list search", () => {
	test("keeps ordinary session pages in the requested descending order", async () => {
		const t = createConvexTest();
		await seedBooking(t, {
			name: "Earlier",
			email: "earlier@example.com",
			sessionStartAt: 4_071_268_800_000
		});
		await seedBooking(t, {
			name: "Latest",
			email: "latest@example.com",
			sessionStartAt: 4_071_441_600_000
		});
		await seedBooking(t, {
			name: "Middle",
			email: "middle@example.com",
			sessionStartAt: 4_071_355_200_000
		});
		const admin = t.withIdentity(adminIdentity);

		const first = await admin.query(api.sessions.admin.listSessions, {
			paginationOpts: { cursor: null, numItems: 2 },
			view: "inbox",
			sortBy: "session",
			sortDirection: "desc"
		});

		expect(first.page.map((row) => row.name)).toEqual(["Latest", "Middle"]);
		expect(first.isDone).toBe(false);

		const last = await admin.query(api.sessions.admin.listSessions, {
			paginationOpts: { cursor: first.continueCursor, numItems: 2 },
			view: "inbox",
			sortBy: "session",
			sortDirection: "desc"
		});

		expect(last.page.map((row) => row.name)).toEqual(["Earlier"]);
		expect(last.isDone).toBe(true);
	});

	test("continues search pages without losing matches and starts a different search at its first page", async () => {
		const t = createConvexTest();
		await seedBooking(t, {
			name: "Cursor first",
			email: "first@example.com",
			searchToken: "cursorbatch"
		});
		await seedBooking(t, {
			name: "Cursor second",
			email: "second@example.com",
			searchToken: "cursorbatch"
		});
		await seedBooking(t, {
			name: "Cursor third",
			email: "third@example.com",
			searchToken: "cursorbatch"
		});
		await seedBooking(t, {
			name: "Different search",
			email: "different@example.com",
			searchToken: "differentbatch"
		});
		const admin = t.withIdentity(adminIdentity);

		const first = await admin.query(api.sessions.admin.listSessions, {
			paginationOpts: { cursor: null, numItems: 2 },
			view: "inbox",
			searchQuery: "cursorbatch"
		});

		expect(first.page).toHaveLength(2);
		expect(first.isDone).toBe(false);
		expect("refineSearch" in first && first.refineSearch).toBe(true);

		const last = await admin.query(api.sessions.admin.listSessions, {
			paginationOpts: { cursor: first.continueCursor, numItems: 2 },
			view: "inbox",
			searchQuery: "cursorbatch"
		});

		expect(last.page).toHaveLength(1);
		expect(last.isDone).toBe(true);
		expect("refineSearch" in last && last.refineSearch).toBe(false);
		expect([...first.page, ...last.page].map((row) => row.name).toSorted()).toEqual([
			"Cursor first",
			"Cursor second",
			"Cursor third"
		]);

		const changed = await admin.query(api.sessions.admin.listSessions, {
			paginationOpts: { cursor: null, numItems: 2 },
			view: "inbox",
			searchQuery: "differentbatch"
		});

		expect(changed.page.map((row) => row.name)).toEqual(["Different search"]);
		expect(changed.isDone).toBe(true);
		expect("refineSearch" in changed && changed.refineSearch).toBe(false);
	});

	test("phone prefix on sessions", async () => {
		const t = createConvexTest();

		const targetId = await seedBooking(t, {
			name: "Phone target",
			email: "phone-target@example.com",
			phone: "+61 412 345 678"
		});

		await seedBooking(t, { name: "Other", email: "other-phone@example.com", phone: "0400000001" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.admin.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: "phone:+61 412 345 678"
			});

		expect(result.page.map((session) => session._id)).toEqual([targetId]);
	});

	test("date prefix on sessions", async () => {
		const t = createConvexTest();

		const targetId = await seedBooking(t, {
			name: "Date target",
			email: "date-target@example.com",
			date: "2099-06-15",
			sessionStartAt: 4_085_132_400_000
		});

		await seedBooking(t, { name: "Other day", email: "other-date@example.com" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.admin.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: "date:15/6/2099"
			});

		expect(result.page.map((session) => session._id)).toEqual([targetId]);
	});

	test("email prefix on sessions", async () => {
		const t = createConvexTest();
		const targetEmail = "search-target@example.com";
		const targetId = await seedBooking(t, { name: "Target", email: targetEmail });
		await seedBooking(t, { name: "Other", email: "other@example.com" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.admin.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: `email:${targetEmail}`
			});

		expect(result.page.map((session) => session._id)).toEqual([targetId]);
	});

	test("receipt prefix on sessions", async () => {
		const t = createConvexTest();
		const receiptNumber = "VV-RECEIPT-SEARCH-001";

		const targetId = await seedBooking(t, {
			name: "Receipt target",
			email: "receipt-target@example.com",
			receiptNumber
		});

		await seedBooking(t, { name: "Other", email: "other-receipt@example.com" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.admin.listSessions, {
				paginationOpts: adminSearchPaginationOpts,
				view: "inbox",
				searchQuery: `receipt:${receiptNumber}`
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
			.query(api.sessions.admin.listSessions, {
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
			.query(api.sessions.admin.listSessions, {
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
	args: {
		name: string;
		email: string;
		date?: string;
		phone?: string;
		searchToken?: string;
		sessionStartAt?: number;
		receiptNumber?: string;
	}
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) => {
		const bookingFields = {
			name: args.name,
			phone: normalizePhone(args.phone ?? "0400000000"),
			accountName: "Test account",
			email: args.email,
			date: args.date ?? "2099-01-01",
			time: "10:00",
			sessionStartAt: args.sessionStartAt ?? 4_071_268_800_000,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed" as const,
			archived: false,
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id",
			notes: args.searchToken,
			receiptNumber: args.receiptNumber
		};

		return ctx.db.insert("bookings", {
			...bookingFields,
			searchBlob: buildBookingSearchBlob(bookingFields)
		});
	});
}
