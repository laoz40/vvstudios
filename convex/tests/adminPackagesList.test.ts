/**
 * Admin packages list views.
 *
 * 1. Inbox list
 *    Returns only unarchived packages.
 *
 * 2. All packages list
 *    Returns archived and unarchived packages.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const paginationOpts = { cursor: null, numItems: 50 };

const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

describe("listPackages admin views", () => {
	test("inbox omits archived packages", async () => {
		const t = createConvexTest();
		const visibleId = await seedPackage(t, "inbox-visible@example.com");
		const archivedId = await seedPackage(t, "inbox-hidden@example.com");
		await t.run((ctx) => ctx.db.patch(archivedId, { hiddenAt: Date.now() }));

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.packages.listPackages, { paginationOpts, view: "inbox" });

		const ids = result.page.map((packageRecord) => packageRecord._id);
		expect(ids).toContain(visibleId);
		expect(ids).not.toContain(archivedId);
	});

	test("all packages includes archived packages", async () => {
		const t = createConvexTest();
		const archivedId = await seedPackage(t, "all-tab-archived@example.com");
		await t.run((ctx) => ctx.db.patch(archivedId, { hiddenAt: Date.now() }));

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.packages.listPackages, { paginationOpts, view: "all" });

		expect(result.page.map((packageRecord) => packageRecord._id)).toContain(archivedId);
	});
});

async function seedPackage(t: TestClient, email: string): Promise<Id<"packages">> {
	const createdAt = Date.now();

	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email,
			duration: "1h",
			addons: [],
			packageSize: 8,
			singleSessionAmount: 200,
			packageSubtotalAmount: 1600,
			discountPercent: 10,
			discountAmount: 160,
			totalDueAmount: 1440,
			status: "paid",
			createdAt,
			paidAt: createdAt,
			expiresAt: createdAt + 100_000
		})
	);
}
