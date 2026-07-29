/**
 * These tests check who can use the admin dashboard features for sessions and packages.
 * They cover signed-out users, signed-in customers, and admins.
 *
 * 1. Reading admin data
 *    Signed-out users and customers must not read the booking or package lists because they
 *    contain private customer and payment data. Admins must be able to read both lists.
 *
 * 2. Running admin-only operations
 *    The following operations are tested:
 *    - mark a session's remaining balance as paid or unpaid;
 *    - mark a package as paid or unpaid, and confirm a package payment;
 *    - change a package adjustment's payment status;
 *    - change booking availability settings;
 *    - edit or archive a session;
 *    - edit or archive a package;
 *    - delete a session's Google Calendar event;
 *    - send session deliverables and invoice emails;
 *    - send a package invoice email;
 *    - generate a new session reschedule link;
 *    - create a custom invoice for a session or package.
 *
 *    Every operation is attempted as both a signed-out user and a customer. Each attempt
 *    must return the correct authorization error and leave all relevant database records
 *    unchanged. This proves unauthorized requests cannot cause hidden side effects.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";
const paginationOpts = { cursor: null, numItems: 10 };

const identities = [
	{ label: "anonymous users", identity: null, reason: "NOT_AUTHENTICATED" },
	{
		label: "non-admin users",
		identity: { publicMetadata: { role: "customer" } },
		reason: "NOT_AUTHORIZED"
	}
] as const;

describe("admin list authorization", () => {
	test.each(identities)("rejects $label from listSessions", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.sessions.listSessions, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason } }
		);
	});

	test.each(identities)("rejects $label from listPackages", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.packages.listPackages, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason } }
		);
	});

	test("allows an admin to read bookings and packages", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity({ publicMetadata: { role: "admin" } });

		const [bookings, packages] = await Promise.all([
			admin.query(api.sessions.listSessions, { paginationOpts }),
			admin.query(api.packages.listPackages, { paginationOpts })
		]);

		expect(bookings.page).toEqual([]);
		expect(packages.page).toEqual([]);
	});
});

type TestClient = ReturnType<typeof createConvexTest>;
type FunctionClient = ReturnType<TestClient["withIdentity"]>;
type TestIds = {
	adjustmentId: Id<"packageAdjustments">;
	bookingId: Id<"bookings">;
	multiBookingId: Id<"multiBookingPackages">;
};

type AdminOperation = {
	name: string;
	call: (client: FunctionClient, ids: TestIds) => Promise<unknown>;
};

const bookingEditArgs = {
	name: "Updated name",
	phone: "0400000000",
	accountName: "Updated account",
	email: "updated@example.com",
	date: "2099-01-01",
	time: "10:00",
	duration: "1 hour",
	service: "Remote Podcast",
	addons: []
};

const operations: AdminOperation[] = [
	{
		name: "set a session remaining balance as paid or unpaid",
		call: (client, { bookingId }) =>
			client.mutation(api.sessions.updateSessionPaidStatus, {
				bookingId,
				paidRemainingBalance: true
			})
	},
	{
		name: "mark a package as unpaid",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.markPackageUnpaid, { packageId: multiBookingId })
	},
	{
		name: "confirm a package payment",
		call: (client, { multiBookingId }) =>
			client.action(api.packagePayment.confirmPackagePayment, { multiBookingId })
	},
	{
		name: "change a package adjustment payment status",
		call: (client, { adjustmentId }) =>
			client.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: true
			})
	},
	{
		name: "change the booking availability windows",
		call: (client) =>
			client.mutation(api.bookingSettings.update, {
				eventBufferMinutes: 15,
				leadTimeMinutes: 60,
				maxDaysAhead: 90,
				weekSchedule: [{ startTime: "09:00", endTime: "17:00" }]
			})
	},
	{
		name: "edit a session",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.updateSessionFromAdmin, { bookingId, ...bookingEditArgs })
	},
	{
		name: "edit a package",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.updatePackageFromAdmin, {
				multiBookingId,
				name: "Updated name",
				phone: "0400000000",
				accountName: "Updated account",
				email: "updated@example.com",
				duration: "1 hour",
				addons: [],
				packageSize: 4
			})
	},
	{
		name: "delete a session Calendar event",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.deleteSessionFromAdmin, { bookingId })
	},
	{
		name: "archive a session",
		call: (client, { bookingId }) =>
			client.mutation(api.sessions.archiveSession, { bookingId, archived: true })
	},
	{
		name: "archive a package",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.archivePackage, { multiBookingId, archived: true })
	},
	{
		name: "send a deliverables email",
		call: (client, { bookingId }) =>
			client.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: "https://drive.google.com/drive/folders/example",
				emailVariant: "first-time"
			})
	},
	{
		name: "send a session invoice email",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.sendBookingInvoiceForBooking, { bookingId })
	},
	{
		name: "send a package invoice email",
		call: (client, { multiBookingId }) =>
			client.action(api.packagePayment.resendPackageInvoiceEmail, { multiBookingId })
	},
	{
		name: "generate a new reschedule link",
		call: (client, { bookingId }) =>
			client.mutation(api.sessionReschedule.createAdminRescheduleLink, { bookingId })
	},
	{
		name: "create a session custom invoice",
		call: (client, { bookingId }) =>
			client.mutation(api.customInvoices.createCustomInvoice, {
				bookingId,
				addons: [],
				includeDepositLineItem: false
			})
	},
	{
		name: "create a package custom invoice",
		call: (client, { multiBookingId }) =>
			client.mutation(api.customInvoices.createPackageCustomInvoice, {
				multiBookingId,
				addons: [],
				packageSize: 4,
				includeDepositLineItem: false
			})
	}
];

describe.each(identities)("admin operations reject $label", ({ identity, reason }) => {
	test.each(operations)("$name without side effects", async (operation) => {
		const t = createConvexTest();
		const ids = await createTestRecords(t);
		const before = await readTestRecords(t, ids);
		const client = identity === null ? t : t.withIdentity(identity);

		const result = await operation.call(client, ids);

		expect(result).toEqual([{ reason }, null]);
		expect(await readTestRecords(t, ids)).toEqual(before);
	});
});

async function createTestRecords(t: TestClient): Promise<TestIds> {
	return await t.run(async (ctx) => {
		const multiBookingId = await ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "test@example.com",
			duration: "1 hour",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: "paid",
			createdAt: 1,
			invoiceDueAt: 2,
			paidAt: 3,
			invoiceEmailStatus: "sent"
		});
		const bookingId = await ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "test@example.com",
			date: "2099-01-01",
			time: "10:00",
			sessionStartAt: 4_071_268_800_000,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id"
		});
		const adjustmentId = await ctx.db.insert("packageAdjustments", {
			outcome: "invoice_required",
			multiBookingId,
			trigger: "all_sessions_completed",
			remotePodcastBookingIds: [bookingId],
			quantity: 1,
			rate: 100,
			totalAmount: 100,
			invoiceNumber: "TEST-1",
			createdAt: 1,
			invoiceDueAt: 2,
			invoiceEmailStatus: "sent",
			paymentStatus: "unpaid"
		});

		return { adjustmentId, bookingId, multiBookingId };
	});
}

async function readTestRecords(t: TestClient, ids: TestIds) {
	return await t.run(async (ctx) => ({
		adjustment: await ctx.db.get(ids.adjustmentId),
		booking: await ctx.db.get(ids.bookingId),
		bookingSettings: await ctx.db.query("bookingSettings").collect(),
		customInvoices: await ctx.db.query("customInvoices").collect(),
		multiBooking: await ctx.db.get(ids.multiBookingId),
		rescheduleLinks: await ctx.db.query("bookingRescheduleLinks").collect()
	}));
}
