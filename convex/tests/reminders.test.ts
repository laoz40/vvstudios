/**
 * These tests cover the daily reminder workflow and its delivery state.
 *
 * 1. Complete daily run
 *    One run sends every due reminder type: tomorrow's booking reminder, package payment reminder,
 *    and package expiry reminder.
 *
 * 2. Eligibility
 *    Records outside the supported lifecycle or date window, already sent reminders, and packages
 *    without remaining sessions are skipped.
 *
 * 3. Duplicate prevention
 *    Concurrent or replayed jobs can claim each reminder only once, so only one email is sent.
 *
 * 4. Delivery results
 *    Successful sends persist sent state; provider failures persist a retryable failure state.
 *    Email delivery is replaced with controlled fakes, so no real messages are sent.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({
	sendBookingReminder: vi.fn(),
	sendPackageExpiryReminder: vi.fn(),
	sendPackagePaymentReminder: vi.fn()
}));

vi.mock("../env", () => ({
	env: {
		GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
		STRIPE_CHECKOUT_RETURN_URL: "https://example.com/checkout/return"
	}
}));

vi.mock("../lib/googleCalendarClient", () => ({
	getGoogleCalendarClient: () => ({ timeZone: "Australia/Sydney" })
}));

vi.mock("../lib/email", () => ({
	sendSessionReminderEmail: providerFakes.sendBookingReminder,
	sendPackageExpiryReminderEmail: providerFakes.sendPackageExpiryReminder,
	sendPackagePaymentReminderEmail: providerFakes.sendPackagePaymentReminder
}));

const now = Date.parse("2030-01-01T23:00:00.000Z");
const tomorrowSessionStartAt = Date.parse("2030-01-03T00:00:00.000Z");
const paymentDueAt = Date.parse("2030-01-03T13:00:00.000Z");
const expiryAt = Date.parse("2030-01-19T13:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(now);
	providerFakes.sendBookingReminder.mockResolvedValue([null, { sent: true }]);
	providerFakes.sendPackageExpiryReminder.mockResolvedValue([null, { sent: true }]);
	providerFakes.sendPackagePaymentReminder.mockResolvedValue([null, { sent: true }]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("daily reminder dispatch", () => {
	test("sends all due booking, package payment, and package expiry reminders", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const paymentPackageId = await seedPackage(t, {
			invoiceDueAt: paymentDueAt,
			status: "pending_payment"
		});
		const expiryPackageId = await seedPackage(t, { expiresAt: expiryAt, status: "paid" });

		await t.action(internal.sessionReminders.sendDueReminders, {});

		expect(providerFakes.sendBookingReminder).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendPackagePaymentReminder).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendPackageExpiryReminder).toHaveBeenCalledTimes(1);
		expect(await readBooking(t, bookingId)).toMatchObject({ reminderEmailSentAt: now });
		expect(await readPackage(t, paymentPackageId)).toMatchObject({
			packageReminderState: { type: "payment", status: "sent", sentAt: now }
		});
		expect(await readPackage(t, expiryPackageId)).toMatchObject({
			packageReminderState: { type: "expiry", status: "sent", sentAt: now }
		});
	});

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
		await seedBooking(t, { status: "cancelled" });
		await seedBooking(t, { sessionStartAt: tomorrowSessionStartAt + 24 * 60 * 60 * 1000 });
		await seedBooking(t, { reminderEmailSentAt: now - 1 });
		await seedPackage(t, {
			invoiceDueAt: paymentDueAt,
			status: "pending_payment",
			packageReminderState: { type: "payment", status: "sent", sentAt: now - 1 }
		});
		const fullPackageId = await seedPackage(t, { expiresAt: expiryAt, status: "paid" });
		for (let index = 0; index < 4; index += 1) {
			await seedBooking(t, {
				multiBookingPackageId: fullPackageId,
				sessionStartAt: now + index,
				status: "confirmed"
			});
		}

		await t.action(internal.sessionReminders.sendDueReminders, {});

		expect(providerFakes.sendBookingReminder).not.toHaveBeenCalled();
		expect(providerFakes.sendPackagePaymentReminder).not.toHaveBeenCalled();
		expect(providerFakes.sendPackageExpiryReminder).not.toHaveBeenCalled();
	});
});

describe("reminder claims and delivery results", () => {
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

		expect(providerFakes.sendBookingReminder).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendPackagePaymentReminder).toHaveBeenCalledTimes(1);
		expect(await readBooking(t, bookingId)).toMatchObject({ reminderEmailSentAt: now });
		expect(await readPackage(t, packageId)).toMatchObject({
			packageReminderState: { type: "payment", status: "sent", sentAt: now }
		});
	});

	test("persists provider failures and allows a later retry", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const packageId = await seedPackage(t, {
			invoiceDueAt: paymentDueAt,
			status: "pending_payment"
		});
		providerFakes.sendBookingReminder
			.mockResolvedValueOnce([{ reason: "EMAIL_REQUEST_FAILED" }, null])
			.mockResolvedValueOnce([null, { sent: true }]);
		providerFakes.sendPackagePaymentReminder
			.mockResolvedValueOnce([{ reason: "EMAIL_REQUEST_FAILED" }, null])
			.mockResolvedValueOnce([null, { sent: true }]);

		await t.action(internal.sessionReminders.sendDueReminders, {});
		const failedBooking = await readBooking(t, bookingId);
		const failedPackage = await readPackage(t, packageId);
		await t.action(internal.sessionReminders.sendDueReminders, {});
		const sentBooking = await readBooking(t, bookingId);
		const sentPackage = await readPackage(t, packageId);

		expect(failedBooking).toMatchObject({ reminderEmailFailureCode: "RESEND_SEND_FAILED" });
		expect(failedBooking?.reminderEmailClaimedAt).toBeUndefined();
		expect(failedPackage).toMatchObject({
			packageReminderState: {
				type: "payment",
				status: "failed",
				failureCode: "EMAIL_REQUEST_FAILED"
			}
		});
		expect(sentBooking).toMatchObject({ reminderEmailSentAt: now });
		expect(sentBooking?.reminderEmailFailureCode).toBeUndefined();
		expect(sentPackage).toMatchObject({
			packageReminderState: { type: "payment", status: "sent", sentAt: now }
		});
		expect(providerFakes.sendBookingReminder).toHaveBeenCalledTimes(2);
		expect(providerFakes.sendPackagePaymentReminder).toHaveBeenCalledTimes(2);
	});
});

async function seedBooking(
	t: TestClient,
	overrides: Partial<{
		multiBookingPackageId: Id<"multiBookingPackages">;
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
		ctx.db.insert("multiBookingPackages", {
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

const readPackage = (t: TestClient, packageId: Id<"multiBookingPackages">) =>
	t.run((ctx) => ctx.db.get(packageId));
