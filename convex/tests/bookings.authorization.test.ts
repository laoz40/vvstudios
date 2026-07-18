import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { createConvexTest } from "../test.setup";
const paginationOpts = { cursor: null, numItems: 10 };

const identities = [
	{ label: "an anonymous user", identity: null, reason: "NOT_AUTHENTICATED" },
	{
		label: "a non-admin user",
		identity: { publicMetadata: { role: "customer" } },
		reason: "NOT_AUTHORIZED"
	}
] as const;

describe("admin list authorization", () => {
	test.each(identities)("rejects $label from getBookings", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.bookings.getBookings, { paginationOpts })).rejects.toMatchObject({
			data: { reason }
		});
	});

	test.each(identities)("rejects $label from listPackages", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.bookings.listPackages, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason } }
		);
	});

	test("allows an admin to read bookings and packages", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity({ publicMetadata: { role: "admin" } });

		const [bookings, packages] = await Promise.all([
			admin.query(api.bookings.getBookings, { paginationOpts }),
			admin.query(api.bookings.listPackages, { paginationOpts })
		]);

		expect(bookings.page).toEqual([]);
		expect(packages.page).toEqual([]);
	});
});
