/**
 * These tests verify the booking settings update service boundaries.
 *
 * 1. Valid settings are saved without returning an unused success payload.
 * 2. Invalid settings return an expected tuple error without writing anything.
 * 3. Unexpected database failures reject instead of becoming expected business errors.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const validSettings = {
	eventBufferMinutes: 15,
	leadTimeMinutes: 60,
	maxDaysAhead: 90,
	weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" }))
};

function createAdminClient() {
	const testClient = createConvexTest();
	return {
		testClient,
		admin: testClient.withIdentity({
			email: "admin@example.com",
			publicMetadata: { role: "admin" }
		})
	};
}

describe("booking settings updates", () => {
	test("saves valid settings without an unused success payload", async () => {
		const { admin, testClient } = createAdminClient();

		const result = await admin.mutation(api.bookingSettings.update, validSettings);
		const savedSettings = await testClient.run((ctx) =>
			ctx.db
				.query("bookingSettings")
				.withIndex("by_key", (query) => query.eq("key", "main"))
				.unique()
		);

		expect(result).toEqual([null, null]);
		expect(savedSettings).toMatchObject({
			...validSettings,
			key: "main",
			updatedBy: "admin@example.com"
		});
	});

	test("returns an expected error without writing invalid settings", async () => {
		const { admin, testClient } = createAdminClient();

		const result = await admin.mutation(api.bookingSettings.update, {
			...validSettings,
			weekSchedule: []
		});

		expect(result).toEqual([{ reason: "INVALID_BOOKING_SETTINGS" }, null]);
		expect(await testClient.run((ctx) => ctx.db.query("bookingSettings").collect())).toEqual([]);
	});

	test("rejects unexpected database failures instead of returning a business error", async () => {
		const { admin, testClient } = createAdminClient();

		await testClient.run(async (ctx) => {
			await ctx.db.insert("bookingSettings", { ...validSettings, key: "main", updatedAt: 1 });
			await ctx.db.insert("bookingSettings", { ...validSettings, key: "main", updatedAt: 2 });
		});

		await expect(admin.mutation(api.bookingSettings.update, validSettings)).rejects.toThrow();
	});
});
