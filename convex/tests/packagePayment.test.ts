/**
 * These tests cover the package scheduling lifecycle created when an admin confirms payment.
 *
 * 1. Successful payment confirmation
 *    The package must become paid, preserve the payment time, calculate its package-size-based
 *    expiry, activate a hashed scheduling token, and record the successful scheduling email.
 *
 * 2. Package expiry
 *    Confirmation must schedule a backend job for the correct package and expiry time.
 *    That job will check whether the package needs a final adjustment invoice.
 *
 * Email delivery is replaced with a fake, so no real provider request is made.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { getMultiBookingExpiresAt } from "../../src/sites/studio/features/booking-form/lib/booking-pricing";
import { hashRescheduleToken } from "../lib/bookingRescheduleLinks";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({ sendScheduleEmail: vi.fn() }));

vi.mock("../env", () => ({
	env: { STRIPE_CHECKOUT_RETURN_URL: "https://example.com/checkout/return" }
}));

vi.mock("../lib/email", () => ({ sendMultiBookingScheduleEmail: providerFakes.sendScheduleEmail }));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.sendScheduleEmail.mockResolvedValue([null, { sent: true }]);
});

describe("package payment confirmation", () => {
	test("initializes the complete package scheduling lifecycle", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const expiresAt = getMultiBookingExpiresAt(now, 4);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.multiBookings.confirmPackagePayment, { multiBookingId });
		const { packageRecord, scheduledJobs } = await readLifecycleState(t, multiBookingId);
		const emailArgs = providerFakes.sendScheduleEmail.mock.calls[0]?.[0];
		const scheduleToken = getScheduleToken(emailArgs?.scheduleUrl);

		expect(result).toEqual([null, { paid: true, scheduleEmailStatus: "sent" }]);
		expect(packageRecord).toMatchObject({
			expiresAt,
			paidAt: now,
			scheduleLinkStatus: "active",
			status: "paid"
		});
		expect(packageRecord?.scheduleTokenHash).toBe(await hashRescheduleToken(scheduleToken));
		expect(packageRecord?.scheduleTokenHash).not.toBe(scheduleToken);
		expect(providerFakes.sendScheduleEmail).toHaveBeenCalledTimes(1);
		expect(emailArgs).toMatchObject({
			bookedAt: now,
			email: "customer@example.com",
			expiresAt,
			name: "Test customer",
			packageSize: 4,
			scheduleUrl: expect.stringContaining("https://example.com/package-schedule/")
		});
		expect(scheduledJobs).toHaveLength(1);
		expect(scheduledJobs[0]).toMatchObject({
			args: [{ expectedExpiresAt: expiresAt, multiBookingId }],
			scheduledTime: expiresAt
		});
	});
});

async function seedPendingPackage(t: TestClient) {
	return await t.run(async (ctx) => {
		await ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 90,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		});

		return await ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: "pending_payment",
			createdAt: now,
			invoiceDueAt: now,
			invoiceEmailStatus: "sent"
		});
	});
}

async function readLifecycleState(
	t: TestClient,
	multiBookingId: Awaited<ReturnType<typeof seedPendingPackage>>
) {
	return await t.run(async (ctx) => ({
		packageRecord: await ctx.db.get(multiBookingId),
		scheduledJobs: await ctx.db.system.query("_scheduled_functions").collect()
	}));
}

function getScheduleToken(scheduleUrl: unknown) {
	if (typeof scheduleUrl !== "string") {
		throw new Error("Scheduling email did not contain a URL");
	}

	const token = new URL(scheduleUrl).pathname.split("/").at(-1);
	if (!token) {
		throw new Error("Scheduling URL did not contain a token");
	}

	return decodeURIComponent(token);
}
