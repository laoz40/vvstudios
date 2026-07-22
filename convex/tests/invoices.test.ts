/**
 * These tests protect invoice totals, stored package pricing, custom invoice creation, and downloads.
 *
 * 1. Session invoice totals
 *    Duration, add-ons, editing quantities, deposit, and a manual override must create a coherent,
 *    nonnegative invoice whose line items balance to the final total.
 *
 * 2. Package pricing snapshots
 *    Package invoice artifacts must use the commercial amounts and line items saved at purchase
 *    time instead of recalculating them from current pricing.
 *
 * 3. Custom invoice creation
 *    Only an admin with an existing session or package and a finite nonnegative total may create
 *    an invoice. Rejected requests must leave the database unchanged.
 *
 * 4. Invoice downloads
 *    Public session and package downloads enforce record existence, lifecycle state, and the
 *    one-hour access window. Admin package downloads remain available after that window.
 *
 * 5. Invoice email selection
 *    The original invoice remains the default. A selected custom invoice must belong to the
 *    booking and pass its exact stored values into the email artifact flow.
 *
 * Email delivery and reschedule-link creation are replaced with fakes, so no provider is called.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	createBookingInvoiceArtifactsForBooking,
	createMultiBookingInvoiceArtifacts
} from "../lib/bookingInvoiceArtifacts";
import { createConvexTest } from "../test.setup";
import { buildBookingInvoiceData } from "../../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";

type SendInvoiceEmails = typeof import("../lib/email").sendBookingInvoiceEmailsForBooking;

const providerFakes = vi.hoisted(() => ({ sendInvoiceEmails: vi.fn<SendInvoiceEmails>() }));

vi.mock("../lib/email", () => ({
	sendBookingInvoiceEmailsForBooking: providerFakes.sendInvoiceEmails
}));

vi.mock("../bookingReschedule", () => ({
	createRescheduleUrlForBooking: vi.fn().mockResolvedValue([null, "https://example.com/reschedule"])
}));

const now = Date.parse("2030-01-10T00:00:00.000Z");
const oneHour = 60 * 60 * 1000;
const adminIdentity = { email: "admin@example.com", publicMetadata: { role: "admin" } };
type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(now);
	providerFakes.sendInvoiceEmails.mockResolvedValue([null, { sent: true }]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("invoice financial integrity", () => {
	test("builds a balanced session invoice from quantities, deposit, and an admin override", async () => {
		const bookingId = await seedBooking(createConvexTest());
		const data = buildBookingInvoiceData({
			bookingId,
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-20",
			time: "10:00",
			duration: "2h",
			service: "Table Setup",
			addons: ["Teleprompter", "Essential Edit", "Clips Package"],
			essentialEditQuantity: "2",
			clipsPackageQuantity: "3",
			leadTimeMinutes: 60,
			createdAt: now,
			customTotalDueAmount: 700
		});

		expect(data.amounts).toMatchObject({
			baseAmount: 299,
			addonsAmount: 464,
			depositAmount: 50,
			subtotalAmount: 750,
			totalDueAmount: 700
		});
		expect(data.lineItems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ description: "Essential Edit", quantity: 2, amount: 198 }),
				expect.objectContaining({ description: "Clips Package", quantity: 3, amount: 237 }),
				expect.objectContaining({ description: "Deposit paid", amount: -50 }),
				expect.objectContaining({ description: "Manual price adjustment", amount: -13 })
			])
		);
		expect(data.lineItems.reduce((total, item) => total + item.amount, 0)).toBe(
			data.amounts.totalDueAmount
		);
	});

	test("clamps an ordinary session invoice total at zero", async () => {
		const bookingId = await seedBooking(createConvexTest());
		const data = buildBookingInvoiceData({
			bookingId,
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-20",
			time: "10:00",
			duration: "1h",
			addons: [],
			leadTimeMinutes: 60
		});

		expect(data.amounts.totalDueAmount).toBe(0);
		expect(data.amounts.totalDueAmount).toBeGreaterThanOrEqual(0);
	});

	test("builds a selected custom invoice from its stored number and total", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const { booking, customInvoice } = await t.run(async (ctx) => {
			const customInvoiceId = await ctx.db.insert("customInvoices", {
				bookingId,
				invoiceNumber: "VV-CUSTOM-001",
				duration: "1h",
				addons: ["Teleprompter"],
				includeDepositLineItem: false,
				customTotalDueAmount: 321,
				createdAt: now,
				createdBy: "admin@example.com"
			});

			return {
				booking: await ctx.db.get(bookingId),
				customInvoice: await ctx.db.get(customInvoiceId)
			};
		});
		if (!booking || !customInvoice) throw new Error("Expected invoice source records");

		const [error, result] = createBookingInvoiceArtifactsForBooking(booking, now, {
			customInvoice,
			leadTimeMinutes: 60
		});

		expect(error).toBeNull();
		expect(result?.artifacts.data.invoice.number).toBe("VV-CUSTOM-001");
		expect(result?.artifacts.data.amounts.totalDueAmount).toBe(321);
		expect(result?.artifacts.data.lineItems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ description: "Manual price adjustment", amount: 292 })
			])
		);
	});

	test("uses the package commercial snapshot without recalculating current prices", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t, { createdAt: now });
		const multiBooking = await t.run((ctx) => ctx.db.get(packageId));
		if (!multiBooking) throw new Error("Expected seeded package");

		const [error, result] = await createMultiBookingInvoiceArtifacts(multiBooking, {
			leadTimeMinutes: 60
		});

		expect(error).toBeNull();
		expect(result?.artifacts.data.amounts).toMatchObject({
			subtotalAmount: 912.34,
			totalDueAmount: 876.54
		});
		expect(result?.artifacts.data.lineItems).toEqual([
			{ amount: 999.99, description: "Stored studio package", quantity: 4, rate: 249.9975 },
			{ amount: -123.45, description: "Stored package discount", quantity: 1, rate: -123.45 }
		]);
	});
});

describe("custom invoice creation", () => {
	test.each([
		{ label: "anonymous user", identity: null, reason: "NOT_AUTHENTICATED" },
		{
			label: "non-admin user",
			identity: { publicMetadata: { role: "customer" } },
			reason: "NOT_AUTHORIZED"
		}
	] as const)("rejects an $label without creating an invoice", async ({ identity, reason }) => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const client = identity ? t.withIdentity(identity) : t;

		const result = await client.mutation(api.customInvoices.createCustomInvoice, {
			bookingId,
			addons: [],
			includeDepositLineItem: true,
			customTotalDueAmount: 250
		});

		expect(result).toEqual([{ reason }, null]);
		expect(await readCustomInvoices(t)).toEqual([]);
	});

	test.each([-1, Number.POSITIVE_INFINITY, Number.NaN])(
		"rejects invalid custom total %s without creating an invoice",
		async (customTotalDueAmount) => {
			const t = createConvexTest();
			const bookingId = await seedBooking(t);

			const result = await t
				.withIdentity(adminIdentity)
				.mutation(api.customInvoices.createCustomInvoice, {
					bookingId,
					addons: [],
					includeDepositLineItem: true,
					customTotalDueAmount
				});

			expect(result).toEqual([{ reason: "INVALID_CUSTOM_TOTAL_DUE_AMOUNT" }, null]);
			expect(await readCustomInvoices(t)).toEqual([]);
		}
	);

	test("rejects missing session and package sources without creating an invoice", async () => {
		const t = createConvexTest();
		const { bookingId, packageId } = await seedAndDeleteSources(t);
		const admin = t.withIdentity(adminIdentity);

		const bookingResult = await admin.mutation(api.customInvoices.createCustomInvoice, {
			bookingId,
			addons: [],
			includeDepositLineItem: true
		});
		const packageResult = await admin.mutation(api.customInvoices.createPackageCustomInvoice, {
			multiBookingId: packageId,
			addons: [],
			packageSize: 4,
			includeDepositLineItem: true
		});

		expect(bookingResult).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(packageResult).toEqual([{ reason: "PACKAGE_NOT_FOUND" }, null]);
		expect(await readCustomInvoices(t)).toEqual([]);
	});

	test("stores final numbered custom invoices for valid session and package sources", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const packageId = await seedPackage(t, { createdAt: now });
		const admin = t.withIdentity(adminIdentity);

		const bookingResult = await admin.mutation(api.customInvoices.createCustomInvoice, {
			bookingId,
			addons: ["Teleprompter"],
			includeDepositLineItem: false,
			customTotalDueAmount: 321
		});
		const packageResult = await admin.mutation(api.customInvoices.createPackageCustomInvoice, {
			multiBookingId: packageId,
			addons: [],
			packageSize: 4,
			includeDepositLineItem: true,
			customTotalDueAmount: 654
		});
		const invoices = await readCustomInvoices(t);

		expect(bookingResult[0]).toBeNull();
		expect(packageResult[0]).toBeNull();
		expect(invoices).toHaveLength(2);
		expect(invoices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ bookingId, customTotalDueAmount: 321 }),
				expect.objectContaining({ multiBookingId: packageId, customTotalDueAmount: 654 })
			])
		);
		for (const invoice of invoices) expect(invoice.invoiceNumber).toMatch(/^VV-20300110-/);
	});
});

describe("invoice download access", () => {
	test("rejects missing, unconfirmed, and expired public session invoices", async () => {
		const t = createConvexTest();
		const missing = await t.action(api.invoices.getBookingInvoicePdfByStripeSessionId, {
			stripeSessionId: "missing"
		});
		const pendingId = await seedBooking(t, {
			status: "pending_payment",
			stripeSessionId: "pending"
		});
		const expiredId = await seedBooking(t, {
			status: "confirmed",
			stripeSessionId: "expired",
			paymentCompletedAt: now - oneHour - 1
		});

		expect(missing).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(
			await t.action(api.invoices.getBookingInvoicePdfByStripeSessionId, {
				stripeSessionId: "pending"
			})
		).toEqual([{ reason: "BOOKING_NOT_CONFIRMED" }, null]);
		expect(
			await t.action(api.invoices.getBookingInvoicePdfByStripeSessionId, {
				stripeSessionId: "expired"
			})
		).toEqual([{ reason: "INVOICE_DOWNLOAD_EXPIRED" }, null]);
		expect([pendingId, expiredId]).toHaveLength(2);
	});

	test("allows current public downloads for confirmed and email-failed sessions", async () => {
		const t = createConvexTest();
		await seedBooking(t, { status: "confirmed", stripeSessionId: "confirmed" });
		await seedBooking(t, { status: "email_failed", stripeSessionId: "email-failed" });

		for (const stripeSessionId of ["confirmed", "email-failed"]) {
			const [error, payload] = await t.action(api.invoices.getBookingInvoicePdfByStripeSessionId, {
				stripeSessionId
			});
			expect(error).toBeNull();
			expect(payload).toMatchObject({ contentType: "application/pdf" });
			expect(payload?.content.byteLength).toBeGreaterThan(0);
		}
	});

	test("expires public package downloads while keeping admin download available", async () => {
		const t = createConvexTest();
		const currentPackageId = await seedPackage(t, { createdAt: now });
		const expiredPackageId = await seedPackage(t, { createdAt: now - oneHour - 1 });

		const missingId = await t.run(async (ctx) => {
			const id = await ctx.db.insert("multiBookingPackages", packageFields(now));
			await ctx.db.delete(id);
			return id;
		});
		expect(
			await t.action(api.invoices.getMultiBookingInvoicePdfById, { multiBookingId: missingId })
		).toEqual([{ reason: "PACKAGE_NOT_FOUND" }, null]);
		expect(
			await t.action(api.invoices.getMultiBookingInvoicePdfById, {
				multiBookingId: expiredPackageId
			})
		).toEqual([{ reason: "INVOICE_DOWNLOAD_EXPIRED" }, null]);

		const [publicError, publicPayload] = await t.action(
			api.invoices.getMultiBookingInvoicePdfById,
			{ multiBookingId: currentPackageId }
		);
		const [adminError, adminPayload] = await t
			.withIdentity(adminIdentity)
			.action(api.invoices.getAdminMultiBookingInvoicePdfById, {
				multiBookingId: expiredPackageId
			});
		expect(publicError).toBeNull();
		expect(publicPayload?.content.byteLength).toBeGreaterThan(0);
		expect(adminError).toBeNull();
		expect(adminPayload?.content.byteLength).toBeGreaterThan(0);
	});
});

describe("session invoice email selection", () => {
	test("sends the original booking invoice when no custom invoice is selected", async () => {
		const t = createConvexTest();
		await ensureBookingSettings(t);
		const bookingId = await seedBooking(t);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.sendBookingInvoiceForBooking, { bookingId });

		expect(result).toEqual([null, { sent: true }]);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledWith(
			expect.objectContaining({ _id: bookingId }),
			expect.objectContaining({ customInvoice: undefined })
		);
	});

	test("sends the exact stored custom invoice selected by the admin", async () => {
		const t = createConvexTest();
		await ensureBookingSettings(t);
		const bookingId = await seedBooking(t);
		const customInvoiceId = await seedEmailCustomInvoice(t, bookingId);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.sendBookingInvoiceForBooking, { bookingId, customInvoiceId });

		const [sentBooking, sentOptions] = providerFakes.sendInvoiceEmails.mock.calls[0];

		expect(result).toEqual([null, { sent: true }]);
		expect(sentBooking).toMatchObject({ _id: bookingId });
		expect(sentOptions.customInvoice).toMatchObject({
			_id: customInvoiceId,
			customTotalDueAmount: 321,
			invoiceNumber: "VV-CUSTOM-001"
		});
	});

	test("rejects a custom invoice belonging to another booking", async () => {
		const t = createConvexTest();
		await ensureBookingSettings(t);
		const bookingId = await seedBooking(t);
		const otherBookingId = await seedBooking(t, { email: "other@example.com" });
		const customInvoiceId = await seedEmailCustomInvoice(t, otherBookingId);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.sendBookingInvoiceForBooking, { bookingId, customInvoiceId });

		expect(result).toEqual([{ reason: "CUSTOM_INVOICE_NOT_FOUND" }, null]);
		expect(providerFakes.sendInvoiceEmails).not.toHaveBeenCalled();
	});
});

async function seedBooking(
	t: TestClient,
	overrides: {
		email?: string;
		paymentCompletedAt?: number;
		status?: "pending_payment" | "confirmed" | "email_failed";
		stripeSessionId?: string;
	} = {}
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: overrides.email ?? "customer@example.com",
			date: "2030-01-20",
			time: "10:00",
			sessionStartAt: Date.parse("2030-01-19T23:00:00.000Z"),
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status: overrides.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			paymentCompletedAt: overrides.paymentCompletedAt ?? now,
			stripeSessionId: overrides.stripeSessionId
		})
	);
}

function packageFields(createdAt: number) {
	return {
		name: "Package customer",
		phone: "0400000000",
		accountName: "Package account",
		email: "package@example.com",
		duration: "1h",
		addons: [] as string[],
		packageSize: 4 as const,
		singleSessionAmount: 250,
		packageSubtotalAmount: 912.34,
		discountPercent: 12.5,
		discountAmount: 123.45,
		totalDueAmount: 876.54,
		invoiceLineItems: [
			{ amount: 999.99, description: "Stored studio package", quantity: 4, rate: 249.9975 },
			{ amount: -123.45, description: "Stored package discount", quantity: 1, rate: -123.45 }
		],
		status: "pending_payment" as const,
		createdAt,
		invoiceDueAt: createdAt + 7 * 24 * 60 * 60 * 1000,
		invoiceNumber: "VV-STORED-001",
		invoiceEmailStatus: "sent" as const
	};
}

async function seedPackage(t: TestClient, options: { createdAt: number }) {
	return await t.run((ctx) =>
		ctx.db.insert("multiBookingPackages", packageFields(options.createdAt))
	);
}

async function seedAndDeleteSources(t: TestClient) {
	const bookingId = await seedBooking(t);
	const packageId = await seedPackage(t, { createdAt: now });
	await t.run(async (ctx) => {
		await ctx.db.delete(bookingId);
		await ctx.db.delete(packageId);
	});
	return { bookingId, packageId };
}

async function seedEmailCustomInvoice(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) =>
		ctx.db.insert("customInvoices", {
			bookingId,
			invoiceNumber: "VV-CUSTOM-001",
			service: "Table Setup",
			duration: "1h",
			addons: ["Teleprompter"],
			includeDepositLineItem: true,
			customTotalDueAmount: 321,
			createdAt: now,
			createdBy: "admin@example.com"
		})
	);
}

async function ensureBookingSettings(t: TestClient) {
	await t.run(async (ctx) => {
		const settings = await ctx.db.query("bookingSettings").first();
		if (settings) return;

		await ctx.db.insert("bookingSettings", {
			key: "main",
			eventBufferMinutes: 15,
			leadTimeMinutes: 60,
			maxDaysAhead: 90,
			weekSchedule: [{ startTime: "09:00", endTime: "17:00" }],
			updatedAt: now
		});
	});
}

async function readCustomInvoices(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("customInvoices").collect());
}
