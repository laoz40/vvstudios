/**
 * These tests cover package requests, payment lifecycle, and admin package management.
 *
 * 1. Successful payment confirmation
 *    The package must become paid, preserve the payment time, calculate its package-size-based
 *    expiry, activate a hashed scheduling token, and record the successful scheduling email.
 *
 * 2. Idempotent payment confirmation
 *    Repeated or concurrent confirmations must create only one paid lifecycle, scheduling token,
 *    expiry job, and scheduling email.
 *
 * 3. Scheduling email recovery
 *    A failed scheduling email leaves a retryable paid lifecycle. Retrying rotates the secret token
 *    without changing the original payment or expiry timestamps.
 *
 * 4. Marking a package unpaid
 *    Payment, expiry, scheduling-link, and reminder state are revoked together, and the old token
 *    can no longer read scheduling data.
 *
 * 5. Package expiry
 *    Confirmation must schedule a backend job for the correct package and expiry time.
 *    That job will check whether the package needs a final adjustment invoice.
 *
 * 6. Admin package row appearance
 *    Paid closed-out and paid expired packages are dimmed. Payment overdue and adjustment payment
 *    status alone do not imply package completion and therefore do not dim a row.
 *
 * Customer request creation, invoice delivery, payment confirmation, lifecycle revocation, capacity-safe
 * sizing, and pricing edits are covered here. Authorization is covered by authorization.test.ts.
 * DNS and email providers are replaced with controlled fakes.
 */
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { isAdminPackageRowDimmed } from "#studio/features/admin/lib/admin-packages";
import {
	getMultiBookingExpiresAt,
	getMultiBookingInvoiceDueAt
} from "#studio/features/booking-form/lib/booking-pricing";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
import { createConvexTest } from "#convex/test.setup";

type SendInvoiceEmail = typeof import("#convex/lib/email").sendMultiBookingInvoiceEmail;
type SendScheduleEmail = (
	args: Parameters<typeof import("#convex/lib/email").sendPackageScheduleEmail>[0]
) => unknown;

const providerFakes = vi.hoisted(() => ({
	resolveMx: vi.fn(),
	sendInvoiceEmail: vi.fn<SendInvoiceEmail>(),
	sendScheduleEmail: vi.fn<SendScheduleEmail>()
}));

vi.mock("node:dns/promises", () => ({ resolveMx: providerFakes.resolveMx }));

vi.mock("#convex/env", () => ({
	env: { STRIPE_CHECKOUT_RETURN_URL: "https://example.com/checkout/return" }
}));

vi.mock("#convex/lib/email", () => ({
	sendMultiBookingInvoiceEmail: providerFakes.sendInvoiceEmail,
	sendPackageScheduleEmail: providerFakes.sendScheduleEmail
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };

const validRequest = {
	name: "  Test customer  ",
	phone: " 0400 000 000 ",
	accountName: "  Test account  ",
	abn: "12 345 678 901",
	email: " Customer@gmail.com ",
	duration: "1h",
	addons: ["Teleprompter"],
	notes: "  Please call on arrival  ",
	packageSize: 4 as const
};

const editedPackage = {
	name: "Updated customer",
	phone: "0411 111 111",
	accountName: "Updated account",
	email: "updated@example.com",
	duration: "2h",
	addons: ["Teleprompter"],
	notes: "Updated notes",
	packageSize: 8 as const
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.resolveMx.mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
	providerFakes.sendInvoiceEmail.mockResolvedValue(
		ok({ invoiceNumber: "VV-20300101-TEST", sent: true })
	);
	providerFakes.sendScheduleEmail.mockResolvedValue(ok(null));
});

describe("admin package row appearance", () => {
	test("dims a paid package when its closeout is complete", () => {
		expect(isAdminPackageRowDimmed(createAdminPackageRow({ areSessionsComplete: true }))).toBe(
			true
		);
	});

	test("dims a paid package when it is expired", () => {
		expect(isAdminPackageRowDimmed(createAdminPackageRow({ expiresAt: now - 1 }))).toBe(true);
	});

	test("does not dim a package only because its payment is overdue", () => {
		expect(
			isAdminPackageRowDimmed(
				createAdminPackageRow({ expiresAt: undefined, isPaid: false, status: "pending_payment" })
			)
		).toBe(false);
	});

	test("does not dim a package only because its adjustment is paid", () => {
		expect(isAdminPackageRowDimmed(createAdminPackageRow())).toBe(false);
	});
});

type AdminPackageRowOverrides = Partial<
	Pick<AdminPackageRow, "areSessionsComplete" | "expiresAt" | "isPaid" | "status">
>;

function createAdminPackageRow(overrides: AdminPackageRowOverrides = {}) {
	return {
		adjustment: { invoiceDueAt: now + 1, paymentStatus: "paid" as const },
		expiresAt: now + 1,
		areSessionsComplete: false,
		isPaid: true,
		status: "paid" as const,
		...overrides
	};
}

describe("package payment confirmation", () => {
	test("initializes the complete package scheduling lifecycle", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const expiresAt = getMultiBookingExpiresAt(now, 4);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.packagePayment.confirmPackagePayment, { multiBookingId });
		const { packageRecord, scheduledJobs } = await readLifecycleState(t, multiBookingId);
		const emailArgs = providerFakes.sendScheduleEmail.mock.calls[0][0];
		const scheduleToken = getScheduleToken(emailArgs.scheduleUrl);

		expect(result).toEqual([null, null]);
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
			packageSize: 4
		});
		expect(emailArgs.scheduleUrl).toContain("https://example.com/package-schedule/");
		expect(scheduledJobs).toHaveLength(1);
		expect(scheduledJobs[0]).toMatchObject({
			args: [{ expectedExpiresAt: expiresAt, multiBookingId }],
			scheduledTime: expiresAt
		});
	});

	test("rejects repeated confirmation without replacing the paid lifecycle", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const firstResult = await admin.action(api.packagePayment.confirmPackagePayment, {
			multiBookingId
		});
		const firstState = await readLifecycleState(t, multiBookingId);
		const secondResult = await admin.action(api.packagePayment.confirmPackagePayment, {
			multiBookingId
		});
		const secondState = await readLifecycleState(t, multiBookingId);

		expect(firstResult).toEqual([null, null]);
		expect(secondResult).toEqual([{ reason: "PACKAGE_ALREADY_PAID" }, null]);
		expect(secondState.packageRecord).toEqual(firstState.packageRecord);
		expect(secondState.scheduledJobs).toEqual(firstState.scheduledJobs);
		expect(providerFakes.sendScheduleEmail).toHaveBeenCalledTimes(1);
	});

	test("allows only one concurrent confirmation to create the paid lifecycle", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const results = await Promise.all([
			admin.action(api.packagePayment.confirmPackagePayment, { multiBookingId }),
			admin.action(api.packagePayment.confirmPackagePayment, { multiBookingId })
		]);
		const { packageRecord, scheduledJobs } = await readLifecycleState(t, multiBookingId);

		expect(results).toContainEqual([null, null]);
		expect(results).toContainEqual([{ reason: "PACKAGE_ALREADY_PAID" }, null]);
		expect(packageRecord).toMatchObject({ paidAt: now, status: "paid" });
		expect(scheduledJobs).toHaveLength(1);
		expect(providerFakes.sendScheduleEmail).toHaveBeenCalledTimes(1);
	});

	test("recovers a failed scheduling email by rotating only the token", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const admin = t.withIdentity(adminIdentity);
		providerFakes.sendScheduleEmail
			.mockResolvedValueOnce(err({ reason: "EMAIL_REQUEST_FAILED" }))
			.mockResolvedValueOnce(ok(null));

		const confirmationResult = await admin.action(api.packagePayment.confirmPackagePayment, {
			multiBookingId
		});
		const failedState = await readLifecycleState(t, multiBookingId);
		const firstToken = getScheduleToken(
			providerFakes.sendScheduleEmail.mock.calls[0]?.[0]?.scheduleUrl
		);
		const retryResult = await admin.action(api.packagePayment.retryPackageSchedulingEmail, {
			multiBookingId
		});
		const recoveredState = await readLifecycleState(t, multiBookingId);
		const retryToken = getScheduleToken(
			providerFakes.sendScheduleEmail.mock.calls[1]?.[0]?.scheduleUrl
		);

		expect(confirmationResult).toEqual([{ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }, null]);
		expect(failedState.packageRecord).toMatchObject({
			paidAt: now,
			expiresAt: getMultiBookingExpiresAt(now, 4),
			status: "schedule_email_failed"
		});
		expect(retryResult).toEqual([null, null]);
		expect(recoveredState.packageRecord).toMatchObject({
			paidAt: failedState.packageRecord?.paidAt,
			expiresAt: failedState.packageRecord?.expiresAt,
			status: "paid",
			scheduleLinkStatus: "active"
		});
		expect(retryToken).not.toBe(firstToken);
		expect(failedState.packageRecord?.scheduleTokenHash).toBe(
			await hashRescheduleToken(firstToken)
		);
		expect(recoveredState.packageRecord?.scheduleTokenHash).toBe(
			await hashRescheduleToken(retryToken)
		);
		expect(recoveredState.scheduledJobs).toHaveLength(1);
		expect(recoveredState.scheduledJobs[0]).toMatchObject({
			args: failedState.scheduledJobs[0]?.args,
			name: failedState.scheduledJobs[0]?.name,
			scheduledTime: failedState.scheduledJobs[0]?.scheduledTime
		});
		expect(providerFakes.sendScheduleEmail).toHaveBeenCalledTimes(2);
	});

	test("marking a package unpaid clears lifecycle state and revokes its token", async () => {
		const t = createConvexTest();
		const multiBookingId = await seedPendingPackage(t);
		const admin = t.withIdentity(adminIdentity);
		await admin.action(api.packagePayment.confirmPackagePayment, { multiBookingId });
		const token = getScheduleToken(providerFakes.sendScheduleEmail.mock.calls[0]?.[0]?.scheduleUrl);
		await t.run((ctx) =>
			ctx.db.patch(multiBookingId, {
				packageReminderState: { type: "expiry", status: "sent", sentAt: now }
			})
		);

		const result = await admin.mutation(api.packages.markPackageUnpaid, {
			packageId: multiBookingId
		});
		const { packageRecord } = await readLifecycleState(t, multiBookingId);
		const tokenResult = await t.query(api.packageScheduling.getPackageByToken, { token });

		expect(result).toEqual([null, null]);
		expect(packageRecord).toMatchObject({ status: "pending_payment" });
		expect(packageRecord?.paidAt).toBeUndefined();
		expect(packageRecord?.expiresAt).toBeUndefined();
		expect(packageRecord?.scheduleTokenHash).toBeUndefined();
		expect(packageRecord?.scheduleLinkStatus).toBeUndefined();
		expect(packageRecord?.packageReminderState).toBeUndefined();
		expect(tokenResult).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
	});
});

describe("package request creation", () => {
	test("stores the normalized commercial snapshot and successful invoice delivery", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packagePayment.createPackageRequest, validRequest);
		const packages = await readPackages(t);

		expect(result).toEqual([
			null,
			{ multiBookingId: packages[0]?._id, invoiceEmailStatus: "sent" }
		]);
		expect(packages).toHaveLength(1);
		expect(packages[0]).toMatchObject({
			name: "Test customer",
			phone: "0400 000 000",
			accountName: "Test account",
			abn: "12345678901",
			email: "customer@gmail.com",
			duration: "1h",
			addons: ["Teleprompter"],
			notes: "Please call on arrival",
			packageSize: 4,
			singleSessionAmount: 229,
			packageSubtotalAmount: 916,
			discountPercent: 5,
			discountAmount: 45.8,
			totalDueAmount: 870.2,
			invoiceLineItems: [
				{ amount: 800, description: "Studio Hire (1h)", quantity: 4, rate: 200 },
				{ amount: 116, description: "Teleprompter add-on", quantity: 4, rate: 29 },
				{ amount: -45.8, description: "5% package discount", quantity: 1, rate: -45.8 }
			],
			status: "pending_payment",
			createdAt: now,
			invoiceDueAt: getMultiBookingInvoiceDueAt(now),
			invoiceNumber: "VV-20300101-TEST",
			invoiceEmailStatus: "sent",
			invoiceEmailSentAt: now,
			lastInvoiceEmailAttemptAt: now
		});
		expect(providerFakes.sendInvoiceEmail).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmail.mock.calls[0]?.[0]).toMatchObject({
			status: "pending_payment",
			invoiceEmailStatus: "pending",
			totalDueAmount: 870.2
		});
	});

	test("rejects invalid form data before DNS or invoice delivery", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packagePayment.createPackageRequest, {
			...validRequest,
			name: "   "
		});

		expect(result).toEqual([{ reason: "BOOKING_INVALID_INPUT" }, null]);
		expect(await readPackages(t)).toEqual([]);
		expect(providerFakes.resolveMx).not.toHaveBeenCalled();
		expect(providerFakes.sendInvoiceEmail).not.toHaveBeenCalled();
	});

	test("rejects an undeliverable email without creating or emailing a package", async () => {
		const t = createConvexTest();
		providerFakes.resolveMx.mockResolvedValue([]);

		const result = await t.action(api.packagePayment.createPackageRequest, validRequest);

		expect(result).toEqual([{ reason: "BOOKING_EMAIL_DOMAIN_INVALID" }, null]);
		expect(await readPackages(t)).toEqual([]);
		expect(providerFakes.sendInvoiceEmail).not.toHaveBeenCalled();
	});

	test("preserves the package and records a failed invoice delivery for retry", async () => {
		const t = createConvexTest();
		providerFakes.sendInvoiceEmail.mockResolvedValue(err({ reason: "INVOICE_SEND_FAILED" }));

		const result = await t.action(api.packagePayment.createPackageRequest, validRequest);
		const packages = await readPackages(t);

		expect(result).toEqual([
			null,
			{ multiBookingId: packages[0]?._id, invoiceEmailStatus: "failed" }
		]);
		expect(packages).toHaveLength(1);
		expect(packages[0]).toMatchObject({
			status: "invoice_email_failed",
			invoiceEmailStatus: "failed",
			invoiceEmailFailureCode: "INVOICE_SEND_FAILED",
			lastInvoiceEmailAttemptAt: now
		});
		expect(packages[0]?.invoiceNumber).toBeUndefined();
		expect(packages[0]?.invoiceEmailSentAt).toBeUndefined();
	});
});

describe("admin package management", () => {
	test("rejects shrinking below active capacity without changing the package", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				seedPackageSession(t, packageId, index, index === 4 ? "email_failed" : "confirmed")
			)
		);
		const packageBefore = await readPackage(t, packageId);

		const result = await t
			.withIdentity(adminIdentity)
			.mutation(api.packages.updatePackageFromAdmin, {
				multiBookingId: packageId,
				...editedPackage,
				packageSize: 4
			});

		expect(result).toEqual([{ reason: "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" }, null]);
		expect(await readPackage(t, packageId)).toEqual(packageBefore);
	});

	test("updates a coherent pricing snapshot and isolates a custom final total", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const admin = t.withIdentity(adminIdentity);

		const calculatedResult = await admin.mutation(api.packages.updatePackageFromAdmin, {
			multiBookingId: packageId,
			...editedPackage
		});
		const calculatedPackage = await readPackage(t, packageId);
		if (!calculatedPackage?.invoiceLineItems) throw new Error("Expected package invoice snapshot");

		expect(calculatedResult).toEqual([null, null]);
		expect(calculatedPackage).toMatchObject({
			...editedPackage,
			singleSessionAmount: 328,
			packageSubtotalAmount: 2624,
			discountPercent: 10,
			discountAmount: 262.4,
			totalDueAmount: 2361.6,
			invoiceLineItems: [
				{ amount: 2392, description: "Studio Hire (2h)", quantity: 8, rate: 299 },
				{ amount: 232, description: "Teleprompter add-on", quantity: 8, rate: 29 },
				{ amount: -262.4, description: "10% package discount", quantity: 1, rate: -262.4 }
			]
		});

		const customResult = await admin.mutation(api.packages.updatePackageFromAdmin, {
			multiBookingId: packageId,
			...editedPackage,
			totalDueAmount: 2000
		});
		const customPackage = await readPackage(t, packageId);

		expect(customResult).toEqual([null, null]);
		expect(customPackage).toEqual({
			...calculatedPackage,
			totalDueAmount: 2000,
			invoiceLineItems: [
				...calculatedPackage.invoiceLineItems,
				{
					amount: -361.5999999999999,
					description: "Price adjustment",
					quantity: 1,
					rate: -361.5999999999999
				}
			]
		});
	});
});

async function readPackages(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("multiBookingPackages").collect());
}

async function seedPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400 000 000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 8,
			singleSessionAmount: 200,
			packageSubtotalAmount: 1600,
			discountPercent: 10,
			discountAmount: 160,
			totalDueAmount: 1440,
			invoiceLineItems: [
				{ amount: 1600, description: "Studio Hire (1h)", quantity: 8, rate: 200 },
				{ amount: -160, description: "10% package discount", quantity: 1, rate: -160 }
			],
			status: "paid",
			createdAt: now,
			invoiceDueAt: now,
			paidAt: now,
			expiresAt: now + 100_000,
			invoiceEmailStatus: "sent"
		})
	);
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"multiBookingPackages">,
	index: number,
	status: "confirmed" | "email_failed"
) {
	await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400 000 000",
			accountName: "Test account",
			email: "customer@example.com",
			date: `2030-01-${String(index + 2).padStart(2, "0")}`,
			time: "10:00",
			sessionStartAt: now + (index + 1) * 86_400_000,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status,
			pendingPaymentCreatedAt: now,
			multiBookingPackageId: packageId
		})
	);
}

async function readPackage(t: TestClient, packageId: Id<"multiBookingPackages">) {
	return await t.run((ctx) => ctx.db.get(packageId));
}

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
