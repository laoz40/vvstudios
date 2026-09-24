/**
 * These tests cover the daily reminder workflow and its delivery state.
 *
 * 1. Eligibility
 *    Records outside the supported lifecycle or date window, already sent reminders, and packages
 *    without remaining sessions are skipped.
 *
 * 2. Duplicate prevention
 *    Concurrent or replayed jobs can claim each reminder only once.
 *
 * 3. Reminder scheduling state
 *    A booking records one reminder send, clears stale reminder state on reschedule, and drops
 *    reminder fields when cancelled.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T23:00:00.000Z");

const tomorrowSessionStartAt = Date.parse("2030-01-03T00:00:00.000Z");

const expiryAt = Date.parse("2030-01-19T13:00:00.000Z");

const originalSessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const rescheduledSessionStartAt = Date.parse("2030-01-11T23:00:00.000Z");

const eventBufferMinutes = 15;

const packageScheduleToken = "package-schedule-token";

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

		const alreadySentExpiryPackageId = await seedPackage(t, {
			expiresAt: expiryAt,
			status: "paid",
			packageReminderState: { type: "expiry", status: "sent", sentAt: now - 1 }
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
		expect(await readPackage(t, alreadySentExpiryPackageId)).toMatchObject({
			packageReminderState: { type: "expiry", status: "sent", sentAt: now - 1 }
		});
		expect(await readPackage(t, fullPackageId)).not.toHaveProperty("packageReminderState");
	});
});

describe("reminder scheduling state", () => {
	test("records one reminder send for a confirmed booking", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const claimResult = await t.mutation(internal.sessionReminders.claimReminder, {
			bookingId,
			now
		});

		expect(claimResult[0]).toBeNull();
		expect(claimResult[1]?.session._id).toBe(bookingId);
		expect(
			await t.mutation(internal.sessionReminders.markReminderSent, { bookingId, now })
		).toEqual([null, null]);
		const booking = await readBooking(t, bookingId);

		expect(booking).toMatchObject({ reminderEmailSentAt: now });
		expect(booking?.reminderEmailClaimedAt).toBeUndefined();
		expect(booking?.reminderEmailFailureCode).toBeUndefined();
		expect(
			await t.mutation(internal.sessionReminders.claimReminder, { bookingId, now: now + 1 })
		).toEqual([{ reason: "BOOKING_ALREADY_CLAIMED_OR_SENT" }, null]);
	});

	test("clears reminder state when a booking is rescheduled", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, {
			sessionStartAt: originalSessionStartAt,
			reminderEmailClaimedAt: now - 3,
			reminderEmailFailureCode: "SEND_FAILED",
			reminderEmailSentAt: now - 2
		});

		const reservationResult = await t.mutation(
			internal.sessionScheduling.reserveSessionReservation,
			{
				bookingId,
				duration: "1h",
				eventBufferMinutes,
				now,
				sessionStartAt: rescheduledSessionStartAt
			}
		);

		if (reservationResult[0] !== null || reservationResult[1].outcome !== "reserved") {
			throw new Error("Failed to reserve rescheduled session");
		}

		expect(
			await t.mutation(internal.sessionScheduling.saveClientSessionReschedule, {
				bookingId,
				date: "2030-01-12",
				time: "10:00",
				sessionStartAt: rescheduledSessionStartAt,
				reservation: reservationResult[1].reservation
			})
		).toEqual([null, null]);
		const booking = await readBooking(t, bookingId);

		expect(booking).toMatchObject({ sessionStartAt: rescheduledSessionStartAt });
		expect(booking?.reminderEmailClaimedAt).toBeUndefined();
		expect(booking?.reminderEmailSentAt).toBeUndefined();
		expect(booking?.reminderEmailFailureCode).toBeUndefined();
	});

	test("clears reminder state when a package session is cancelled", async () => {
		const t = createConvexTest();
		const packageId = await seedSchedulablePackage(t);

		const bookingId = await seedBooking(t, {
			packageId,
			reminderEmailClaimedAt: now - 1,
			reminderEmailSentAt: now - 1
		});

		expect(
			await t.mutation(internal.packageScheduling.cancelPackageSession, {
				bookingId,
				token: packageScheduleToken,
				now
			})
		).toEqual([null, { cancelled: true, bookingId }]);
		const booking = await readBooking(t, bookingId);

		expect(booking).toMatchObject({ status: "cancelled" });
		expect(booking?.reminderEmailClaimedAt).toBeUndefined();
		expect(booking?.reminderEmailSentAt).toBeUndefined();
		expect(booking?.reminderEmailFailureCode).toBeUndefined();
	});
});

describe("reminder claims", () => {
	test("allows only one concurrent or replayed send per reminder", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const packageId = await seedPackage(t, { expiresAt: expiryAt, status: "paid" });

		const bookingClaims = await Promise.all([
			t.mutation(internal.sessionReminders.claimReminder, { bookingId, now }),
			t.mutation(internal.sessionReminders.claimReminder, { bookingId, now }),
			t.mutation(internal.sessionReminders.claimReminder, { bookingId, now })
		]);

		const packageClaims = await Promise.all([
			t.mutation(internal.packageReminders.claimPackageReminder, {
				packageId,
				reminderType: "expiry",
				now
			}),
			t.mutation(internal.packageReminders.claimPackageReminder, {
				packageId,
				reminderType: "expiry",
				now
			}),
			t.mutation(internal.packageReminders.claimPackageReminder, {
				packageId,
				reminderType: "expiry",
				now
			})
		]);

		expect(bookingClaims.filter((result) => result[0] === null)).toHaveLength(1);
		expect(packageClaims.filter((result) => result[0] === null)).toHaveLength(1);
		expect(await readBooking(t, bookingId)).toMatchObject({ reminderEmailClaimedAt: now });
		expect(await readPackage(t, packageId)).toMatchObject({
			packageReminderState: { type: "expiry", status: "claimed", claimedAt: now }
		});
	});
});

async function seedSchedulablePackage(t: TestClient) {
	const scheduleTokenHash = await hashRescheduleToken(packageScheduleToken);

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
			status: "paid",
			archived: false,
			createdAt: now - 1,
			paidAt: now - 1,
			expiresAt: expiryAt,
			scheduleTokenHash,
			scheduleLinkStatus: "active"
		})
	);
}

async function seedBooking(
	t: TestClient,
	overrides: Partial<{
		packageId: Id<"packages">;
		reminderEmailClaimedAt: number;
		reminderEmailFailureCode: string;
		reminderEmailSentAt: number;
		sessionStartAt: number;
		status: "confirmed" | "cancelled";
	}> = {}
) {
	return await t.run(async (ctx) => {
		const existingSettings = await ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (query) => query.eq("key", "main"))
			.unique();

		if (!existingSettings) {
			await ctx.db.insert("bookingSettings", {
				key: "main",
				leadTimeMinutes: 60,
				eventBufferMinutes,
				maxDaysAhead: 30,
				weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
				updatedAt: now
			});
		}

		return await ctx.db.insert("bookings", {
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
			archived: false,
			pendingPaymentCreatedAt: now - 1,
			...overrides
		});
	});
}

async function seedPackage(
	t: TestClient,
	lifecycle: {
		status: "pending_payment" | "paid";
		expiresAt?: number;
		packageReminderState?: { type: "expiry"; status: "sent"; sentAt: number };
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
			archived: false,
			createdAt: now - 1,
			expiresAt: lifecycle.expiresAt,
			packageReminderState: lifecycle.packageReminderState
		})
	);
}

const readBooking = (t: TestClient, bookingId: Id<"bookings">) =>
	t.run((ctx) => ctx.db.get(bookingId));

const readPackage = (t: TestClient, packageId: Id<"packages">) =>
	t.run((ctx) => ctx.db.get(packageId));
