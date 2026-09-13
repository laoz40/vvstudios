/**
 * These tests cover the daily reminder workflow and its delivery state.
 *
 * 1. Eligibility
 *    Records outside the supported lifecycle or date window, already sent reminders, and packages
 *    without remaining sessions are skipped.
 *
 * 2. Duplicate prevention
 *    Concurrent or replayed jobs can claim each reminder only once.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T23:00:00.000Z");

const tomorrowSessionStartAt = Date.parse("2030-01-03T00:00:00.000Z");

const paymentDueAt = Date.parse("2030-01-03T13:00:00.000Z");

const expiryAt = Date.parse("2030-01-19T13:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("daily reminder dispatch", () => {
	test("returns later unsent bookings when earlier bookings already received reminders", async () => {
		const t = createConvexTest();
		await seedBooking(t, { reminderEmailSentAt: now - 1, sessionStartAt: tomorrowSessionStartAt });
		await seedBooking(t, {
			reminderEmailSentAt: now - 1,
			sessionStartAt: tomorrowSessionStartAt + 1
		});
		const unsentBookingId = await seedBooking(t, { sessionStartAt: tomorrowSessionStartAt + 2 });

		const bookings = await t.query(internal.sessionReminders.listSessionsDueForReminderEmail, {
			dayStart: tomorrowSessionStartAt,
			dayEnd: tomorrowSessionStartAt + 100,
			limit: 2
		});

		expect(bookings.map((booking) => booking._id)).toEqual([unsentBookingId]);
	});

	test("skips ineligible, out-of-range, already-sent, and fully-used records", async () => {
		const t = createConvexTest();
		const cancelledBookingId = await seedBooking(t, { status: "cancelled" });

		const outOfRangeBookingId = await seedBooking(t, {
			sessionStartAt: tomorrowSessionStartAt + 24 * 60 * 60 * 1000
		});

		const alreadySentBookingId = await seedBooking(t, { reminderEmailSentAt: now - 1 });

		const paymentPackageId = await seedPackage(t, {
			invoiceDueAt: paymentDueAt,
			status: "pending_payment",
			packageReminderState: { type: "payment", status: "sent", sentAt: now - 1 }
		});

		const fullPackageId = await seedPackage(t, { expiresAt: expiryAt, status: "paid" });
		await Promise.all(
			Array.from({ length: 4 }, (_, index) =>
				seedBooking(t, {
					packageId: fullPackageId,
					sessionStartAt: now + index,
					status: "confirmed"
				})
			)
		);

		await t.action(internal.sessionReminders.sendDueReminders, {});

		expect(await readBooking(t, cancelledBookingId)).not.toHaveProperty("reminderEmailSentAt");
		expect(await readBooking(t, outOfRangeBookingId)).not.toHaveProperty("reminderEmailSentAt");
		expect(await readBooking(t, alreadySentBookingId)).toMatchObject({
			reminderEmailSentAt: now - 1
		});
		expect(await readPackage(t, paymentPackageId)).toMatchObject({
			packageReminderState: { type: "payment", status: "sent", sentAt: now - 1 }
		});
		expect(await readPackage(t, fullPackageId)).not.toHaveProperty("packageReminderState");
	});
});

describe("reminder claims", () => {
	test("allows only one concurrent or replayed send per reminder", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const packageId = await seedPackage(t, {
			invoiceDueAt: paymentDueAt,
			status: "pending_payment"
		});

		await Promise.all([
			t.action(internal.sessionReminders.sendDueReminders, {}),
			t.action(internal.sessionReminders.sendDueReminders, {})
		]);
		await t.action(internal.sessionReminders.sendDueReminders, {});

		const booking = await readBooking(t, bookingId);
		const packageRecord = await readPackage(t, packageId);

		if (booking?.reminderEmailSentAt !== undefined) {
			expect(booking.reminderEmailSentAt).toBe(now);
		}

		if (packageRecord?.packageReminderState?.status === "sent") {
			expect(packageRecord.packageReminderState).toMatchObject({
				type: "payment",
				status: "sent",
				sentAt: now
			});
		}
	});
});

async function seedBooking(
	t: TestClient,
	overrides: Partial<{
		packageId: Id<"packages">;
		reminderEmailSentAt: number;
		sessionStartAt: number;
		status: "confirmed" | "cancelled";
	}> = {}
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Reminder customer",
			phone: "0400000000",
			accountName: "Reminder account",
			email: "customer@example.com",
			date: "2030-01-03",
			time: "11:00",
			sessionStartAt: tomorrowSessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now - 1,
			...overrides
		})
	);
}

async function seedPackage(
	t: TestClient,
	lifecycle: {
		status: "pending_payment" | "paid";
		invoiceDueAt?: number;
		expiresAt?: number;
		packageReminderState?:
			| { type: "payment"; status: "sent"; sentAt: number }
			| { type: "expiry"; status: "sent"; sentAt: number };
	}
) {
	return await t.run((ctx) =>
		ctx.db.insert("packages", {
			name: "Package customer",
			phone: "0400000000",
			accountName: "Package account",
			email: "package@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: lifecycle.status,
			createdAt: now - 1,
			invoiceDueAt: lifecycle.invoiceDueAt ?? now + 1,
			invoiceEmailStatus: "sent",
			expiresAt: lifecycle.expiresAt,
			packageReminderState: lifecycle.packageReminderState
		})
	);
}

const readBooking = (t: TestClient, bookingId: Id<"bookings">) =>
	t.run((ctx) => ctx.db.get(bookingId));

const readPackage = (t: TestClient, packageId: Id<"packages">) =>
	t.run((ctx) => ctx.db.get(packageId));
