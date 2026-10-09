/**
 * Admin edits send invoices before saving and reuse the existing invoice history.
 * 1. Confirmation previews leave booking and package details untouched.
 * 2. Stripe failures leave edits unsaved; retry and replay create one invoice.
 * 3. A Calendar save failure retries the saved invoice without another charge.
 * 4. Reductions and previously covered increases need no invoice.
 * 5. Paid totals distinguish outstanding invoices and remaining balances.
 * 6. Stale or forged quotes and unauthorized staff cannot send invoices.
 * 7. Old uncertain Stripe attempts stop rather than recreate an invoice.
 * 8. Package session increases use package billing without Remote Podcast adjustments.
 * 9. Duration conflicts and availability failures stop the invoice before it is sent.
 * 10. Returning to edit after a save failure applies the existing invoice to a fresh quote.
 * 11. Added items are separate Stripe lines; credits and discounts balance the invoice total.
 * 12. Cached checkout payments remain fixed while dashboard paid and unpaid totals follow invoices.
 * 13. Failed Calendar event cleanup keeps the original booking save error after invoicing.
 */
import Stripe from "stripe";
import { google } from "googleapis";
import { z } from "zod";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";
import { bookingDocument, packageDocument } from "#convex/tests/insertDocumentDefaults";
import type { EditInvoiceDraft } from "#convex/services/stripe/editInvoiceValidators";
import type { EditInvoiceQuote } from "#convex/lib/stripe/editInvoiceBilling";
import { mapPackageToAdminRow } from "#studio/features/admin/lib/admin-packages";

const now = Date.parse("2030-01-10T00:00:00Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

const contact = {
	name: "Invoice customer",
	email: "invoice@example.com",
	phone: "0400000000",
	accountName: "Studio account"
};

let failSend: boolean;

let failCalendar: boolean;

let failCalendarUpdate: boolean;

let calendarEvents: Array<{
	id: string;
	organizer?: { email: string };
	start: { dateTime: string };
	end: { dateTime: string };
}>;

let checkoutPaid: number | undefined;

let lostSendResponse: boolean;

let sentInvoices: Set<string>;

let responses: Map<string, { id: string }>;

let stripeLineItems: Array<{ description: string; amount: number }>;

let afterCalendarEventCreate: (() => Promise<void>) | undefined;

let failOrphanCalendarDelete: boolean;

let calendarBoundaryRequests: Array<{ method: string; path: string }>;

async function fetchCalendar(input: RequestInfo | URL, init?: RequestInit) {
	const url = new URL(input instanceof Request ? input.url : input.toString());
	const method = input instanceof Request ? input.method : (init?.method ?? "GET");
	calendarBoundaryRequests.push({ method, path: url.pathname });

	if (failCalendar) return Promise.reject(new Error("Calendar unavailable"));

	if (failCalendarUpdate && url.pathname.endsWith("/event_confirmed"))
		return Promise.reject(new Error("Calendar update unavailable"));

	if (method === "DELETE" && failOrphanCalendarDelete)
		return Response.json({ error: { message: "Calendar delete unavailable" } }, { status: 500 });

	if (method === "POST" && url.pathname.endsWith("/events")) {
		await afterCalendarEventCreate?.();

		return Response.json({ id: "event_orphaned", status: "confirmed" });
	}

	return Response.json(
		url.pathname.endsWith("/events") && method === "GET"
			? { items: calendarEvents }
			: { id: "event_confirmed", status: "confirmed" }
	);
}

function createStripeResponse(
	method: string,
	path: string,
	params: Parameters<typeof Stripe.StripeResource.prototype._makeRequest>[2]
) {
	if (path === "/v1/invoices" && method === "POST") return { id: "in_" + responses.size };

	if (path === "/v1/invoiceitems") {
		const item = z
			.object({
				amount: z
					.number()
					.int()
					.refine((amount) => amount !== 0),
				invoice: z.string(),
				description: z.string()
			})
			.parse(params);

		stripeLineItems.push({ description: item.description, amount: item.amount / 100 });

		return { id: "ii_item" };
	}

	if (path.endsWith("/finalize") || path.endsWith("/send")) {
		const id = path.split("/")[3];

		if (!id) throw new Error("Missing invoice ID");

		if (path.endsWith("/send")) sentInvoices.add(id);

		return { id };
	}

	throw new Error("Unexpected Stripe request " + path);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	failSend = false;
	failCalendar = false;
	failCalendarUpdate = false;
	calendarEvents = [];
	lostSendResponse = false;
	checkoutPaid = undefined;
	sentInvoices = new Set();
	responses = new Map();
	stripeLineItems = [];
	afterCalendarEventCreate = undefined;
	failOrphanCalendarDelete = false;
	calendarBoundaryRequests = [];

	const calendar = google.calendar({
		version: "v3",
		auth: "test-api-key",
		retry: false,
		fetchImplementation: fetchCalendar
	});

	vi.spyOn(google, "calendar").mockReturnValue(calendar);
	vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
		const url = new URL(input instanceof Request ? input.url : input.toString());

		if (url.hostname.includes("googleapis.com")) return fetchCalendar(input, init);

		return Promise.resolve(Response.json({ id: "email_sent" }));
	});
	vi.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(
		(method, path, params, options) => {
			if (path.startsWith("/v1/customers/"))
				return Promise.resolve({ id: "cus_original", email: "stripe-recipient@example.com" });

			if (path.startsWith("/v1/checkout/sessions/"))
				return Promise.resolve({
					amount_total: checkoutPaid ?? (path.endsWith("cs_package") ? 76000 : 20000),
					currency: "aud",
					payment_status: "paid"
				});
			const key = options?.idempotencyKey;

			const cached = key ? responses.get(key) : undefined;

			if (cached) return Promise.resolve(cached);

			if (path.endsWith("/send") && failSend)
				return Promise.reject(new Error("Stripe unavailable"));
			const result = createStripeResponse(method, path, params);

			if (key) responses.set(key, result);

			if (path.endsWith("/send") && lostSendResponse)
				return Promise.reject(new Error("Response lost after sending"));

			return Promise.resolve(result);
		}
	);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

async function setup(kind: "booking" | "package") {
	const t = createConvexTest();
	const staff = t.withIdentity(adminIdentity);

	const draft: EditInvoiceDraft = await t.run(async (ctx) => {
		if (kind === "package") {
			const packageId = await ctx.db.insert(
				"packages",
				packageDocument({
					...contact,
					duration: "1h",
					addons: [],
					packageSize: 4,
					singleSessionAmount: 200,
					packageSubtotalAmount: 800,
					discountPercent: 5,
					discountAmount: 40,
					totalDueAmount: 760,
					status: "paid",
					archived: false,
					createdAt: now,
					paidAt: now,
					stripeSessionId: "cs_package",
					stripeCustomerId: "cus_original"
				})
			);

			return {
				kind,
				values: { ...contact, packageId, duration: "2h", addons: [], packageSize: 4 }
			};
		}

		const bookingId = await ctx.db.insert(
			"bookings",
			bookingDocument({
				...contact,
				date: "2030-01-20",
				time: "10:00",
				sessionStartAt: Date.parse("2030-01-19T23:00:00Z"),
				duration: "1h",
				service: "Table Setup",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: now,
				paymentCompletedAt: now,
				stripeSessionId: "cs_booking",
				stripeCustomerId: "cus_original",
				googleCalendarId: "studio",
				googleEventId: "event_confirmed"
			})
		);

		return {
			kind,
			values: {
				...contact,
				bookingId,
				duration: "2h",
				addons: [],
				date: "2030-01-20",
				time: "10:00",
				service: "Table Setup"
			}
		};
	});

	const target =
		draft.kind === "booking"
			? { kind: "booking" as const, bookingId: draft.values.bookingId }
			: { kind: "package" as const, packageId: draft.values.packageId };

	async function read() {
		return draft.kind === "booking"
			? t.query(internal.sessions.getSessionById, { bookingId: draft.values.bookingId })
			: t.query(internal.packages.getPackageById, { packageId: draft.values.packageId });
	}

	async function quote(values = draft) {
		const [error, result] = await staff.action(api.editInvoicing.getQuote, {
			target,
			draft: values
		});

		if (error) throw new Error(error.reason);

		return result;
	}

	function confirm(q: EditInvoiceQuote, values = draft) {
		return staff.action(api.editInvoicing.saveChangesAndSendInvoice, {
			draft: values,
			requestId: q.requestId,
			revision: q.revision,
			total: q.total,
			amount: q.amount
		});
	}

	return { t, staff, draft, target, read, quote, confirm };
}

test.each(["booking", "package"] as const)(
	"%s invoice previews leave all saved details unchanged",
	async (kind) => {
		const flow = await setup(kind);
		const before = await flow.read();
		expect(await flow.quote()).toMatchObject({
			amount: kind === "booking" ? 99 : 376.2,
			paidAmount: kind === "booking" ? 200 : 760,
			customerEmail: "stripe-recipient@example.com"
		});
		expect(await flow.read()).toEqual(before);
		expect(sentInvoices.size).toBe(0);
	}
);

test("duration and added quantities become separate preview and Stripe invoice lines", async () => {
	const flow = await setup("booking");

	if (flow.draft.kind !== "booking") throw new Error("Expected booking");

	const draft: EditInvoiceDraft = {
		...flow.draft,
		values: {
			...flow.draft.values,
			addons: ["Essential Edit", "Teleprompter"],
			essentialEditQuantity: "2"
		}
	};

	const q = await flow.quote(draft);

	const expected = [
		{ description: "Studio hire: 1h → 2h", amount: 99 },
		{ description: "Rough Cut x2", amount: 200 },
		{ description: "Teleprompter", amount: 29 }
	];

	expect(q).toMatchObject({ amount: 328, lineItems: expected });
	expect((await flow.confirm(q, draft))[0]).toBeNull();
	expect(stripeLineItems).toEqual(expected);

	if (flow.target.kind !== "booking") throw new Error("Expected booking");

	const [error, invoices] = await flow.staff.query(
		api.stripeInvoices.listStripeInvoicesForBooking,
		{ bookingId: flow.target.bookingId }
	);

	expect(error).toBeNull();
	expect(invoices).toMatchObject([{ totalAmount: 328, lineItems: expected }]);
});

test("removing an add-on credits the itemized increase before invoicing", async () => {
	const flow = await setup("booking");

	if (flow.target.kind !== "booking" || flow.draft.kind !== "booking")
		throw new Error("Expected booking");
	const bookingId = flow.target.bookingId;

	await flow.t.run((ctx) => ctx.db.patch("bookings", bookingId, { addons: ["Teleprompter"] }));

	const draft: EditInvoiceDraft = {
		...flow.draft,
		values: {
			...flow.draft.values,
			duration: "1h",
			addons: ["Essential Edit"],
			essentialEditQuantity: "1"
		}
	};

	const q = await flow.quote(draft);

	const expected = [
		{ description: "Rough Cut", amount: 100 },
		{ description: "Credits and pricing adjustments", amount: -29 }
	];

	expect(q).toMatchObject({ amount: 71, lineItems: expected });
	expect((await flow.confirm(q, draft))[0]).toBeNull();
	expect(stripeLineItems).toEqual(expected);
});

test("package duration increases include the discount adjustment in Stripe", async () => {
	const flow = await setup("package");
	const q = await flow.quote();

	const expected = [
		{ description: "Studio hire (4 sessions): 1h → 2h", amount: 396 },
		{ description: "Credits and pricing adjustments", amount: -19.8 }
	];

	expect(q).toMatchObject({ amount: 376.2, lineItems: expected });
	expect((await flow.confirm(q))[0]).toBeNull();
	expect(stripeLineItems).toEqual(expected);
});

test("a previously invoiced duration increase credits a later itemized edit", async () => {
	const flow = await setup("booking");

	if (flow.draft.kind !== "booking") throw new Error("Expected booking");

	const first = await flow.quote();
	failCalendarUpdate = true;

	expect((await flow.confirm(first))[0]).toMatchObject({ invoiceSent: true });
	failCalendarUpdate = false;

	const draft: EditInvoiceDraft = {
		...flow.draft,
		values: { ...flow.draft.values, addons: ["Essential Edit"], essentialEditQuantity: "1" }
	};

	const q = await flow.quote(draft);

	expect(q).toMatchObject({
		amount: 100,
		lineItems: [
			{ description: "Studio hire: 1h → 2h", amount: 99 },
			{ description: "Rough Cut", amount: 100 },
			{ description: "Credits and pricing adjustments", amount: -99 }
		]
	});
	expect((await flow.confirm(q, draft))[0]).toBeNull();
	expect(await flow.read()).toMatchObject({ duration: "2h", addons: ["Essential Edit"] });
	expect(sentInvoices.size).toBe(2);
});

test.each(["booking", "package"] as const)(
	"%s Stripe failures leave edits unsaved and retry one invoice",
	async (kind) => {
		const flow = await setup(kind);
		const before = await flow.read();
		const q = await flow.quote();
		failSend = true;
		expect(await flow.confirm(q)).toEqual([{ reason: "STRIPE_INVOICE_FAILED" }, null]);
		expect(await flow.read()).toEqual(before);
		failSend = false;
		expect((await flow.confirm(q))[0]).toBeNull();
		expect(await flow.read()).toMatchObject({ duration: "2h" });
		expect((await flow.confirm(q))[0]).toBeNull();
		expect(sentInvoices.size).toBe(1);
	}
);

test("a lost Stripe send response retries the invoice before saving", async () => {
	const flow = await setup("package");
	const q = await flow.quote();
	lostSendResponse = true;
	expect((await flow.confirm(q))[0]).toEqual({ reason: "STRIPE_INVOICE_FAILED" });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
	lostSendResponse = false;
	expect((await flow.confirm(q))[0]).toBeNull();
	expect(sentInvoices.size).toBe(1);
});

test("a Calendar save failure retries the already sent invoice without another charge", async () => {
	const flow = await setup("booking");
	const q = await flow.quote();
	failCalendarUpdate = true;
	expect((await flow.confirm(q))[0]).toMatchObject({ invoiceSent: true });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
	vi.setSystemTime(now + 2 * 24 * 60 * 60 * 1000);
	failCalendarUpdate = false;
	expect((await flow.confirm(q))[0]).toBeNull();
	expect(await flow.read()).toMatchObject({ duration: "2h" });
	expect(sentInvoices.size).toBe(1);
});

test("keeps the booking save error when orphan Calendar cleanup fails after invoicing", async () => {
	const flow = await setup("booking");

	if (flow.draft.kind !== "booking") throw new Error("Expected booking");

	const bookingId = flow.draft.values.bookingId;

	await flow.t.run((ctx) =>
		ctx.db.patch("bookings", bookingId, {
			status: "failed",
			bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED"
		})
	);
	const q = await flow.quote();
	afterCalendarEventCreate = () => flow.t.run((ctx) => ctx.db.delete("bookings", bookingId));
	failOrphanCalendarDelete = true;
	vi.spyOn(console, "error").mockImplementation(() => {});

	expect(await flow.confirm(q)).toEqual([{ reason: "BOOKING_NOT_FOUND", invoiceSent: true }, null]);
	expect(calendarBoundaryRequests).toContainEqual({
		method: "DELETE",
		path: "/calendar/v3/calendars/primary/events/event_orphaned"
	});
	expect(sentInvoices.size).toBe(1);
});

test("reviewing again after a sent invoice saves the duration without invoicing twice", async () => {
	const flow = await setup("booking");
	const q = await flow.quote();
	failCalendarUpdate = true;

	expect((await flow.confirm(q))[0]).toEqual({
		reason: "GOOGLE_CALENDAR_UPDATE_FAILED",
		invoiceSent: true
	});
	failCalendarUpdate = false;

	expect(await flow.quote()).toMatchObject({ amount: 0, currentTotal: 200, total: 299 });
	expect(
		(await flow.staff.action(api.editInvoicing.saveNonbillableDraft, { draft: flow.draft }))[0]
	).toBeNull();
	expect(await flow.read()).toMatchObject({ duration: "2h" });
	expect(sentInvoices.size).toBe(1);
});

test("a duration conflict is rejected before sending an invoice", async () => {
	const flow = await setup("booking");
	const q = await flow.quote();
	calendarEvents = [
		{
			id: "other_booking",
			start: { dateTime: "2030-01-20T11:00:00+11:00" },
			end: { dateTime: "2030-01-20T12:00:00+11:00" }
		}
	];

	expect((await flow.confirm(q))[0]).toEqual({ reason: "BOOKING_TIME_UNAVAILABLE" });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
	expect(sentInvoices.size).toBe(0);
});

test("an availability lookup failure leaves the duration and invoice untouched", async () => {
	const flow = await setup("booking");
	const q = await flow.quote();
	failCalendar = true;

	expect((await flow.confirm(q))[0]).toEqual({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
	expect(sentInvoices.size).toBe(0);
});

test("reducing and raising a covered total does not invoice the increase twice", async () => {
	const flow = await setup("package");
	expect((await flow.confirm(await flow.quote()))[0]).toBeNull();

	if (flow.draft.kind !== "package") throw new Error("Expected package");

	const reduced: EditInvoiceDraft = {
		...flow.draft,
		values: { ...flow.draft.values, duration: "1h" }
	};

	expect(
		(await flow.staff.action(api.editInvoicing.saveNonbillableDraft, { draft: reduced }))[0]
	).toBeNull();
	expect(await flow.quote()).toMatchObject({
		currentTotal: 760,
		total: 1136.2,
		amount: 0,
		paidAmount: 760
	});
	expect(
		(await flow.staff.action(api.editInvoicing.saveNonbillableDraft, { draft: flow.draft }))[0]
	).toBeNull();
	expect(sentInvoices.size).toBe(1);
});

test("a deposit and its recorded remaining balance cover the original price once", async () => {
	const flow = await setup("booking");

	if (flow.target.kind !== "booking") throw new Error("Expected booking");
	const bookingId = flow.target.bookingId;
	checkoutPaid = 10000;
	await flow.t.run((ctx) => ctx.db.patch("bookings", bookingId, { remainingBalanceAmount: 100 }));
	expect(await flow.quote()).toMatchObject({ amount: 99, paidAmount: 100 });
});

test("stale and forged quotes leave the package unsaved", async () => {
	const flow = await setup("package");
	const q = await flow.quote();
	expect((await flow.confirm({ ...q, amount: 1 }))[0]).toEqual({ reason: "BILLING_QUOTE_CHANGED" });

	if (flow.draft.kind !== "package") throw new Error("Expected package");
	await flow.staff.mutation(api.packages.updatePackageFromAdmin, {
		...flow.draft.values,
		duration: "1h",
		name: "Another admin's edit"
	});
	expect((await flow.confirm(q))[0]).toMatchObject({ reason: "BILLING_QUOTE_CHANGED" });
	expect(await flow.read()).toMatchObject({ duration: "1h", name: "Another admin's edit" });
	expect(sentInvoices.size).toBe(0);
});

test("staff without invoice permission cannot save a billable edit", async () => {
	const flow = await setup("package");
	const q = await flow.quote();

	const result = await flow.t
		.withIdentity({ publicMetadata: { role: "editor" } })
		.action(api.editInvoicing.saveChangesAndSendInvoice, {
			draft: flow.draft,
			requestId: q.requestId,
			revision: q.revision,
			total: q.total,
			amount: q.amount
		});

	expect(result[0]).toEqual({ reason: "NOT_AUTHORIZED" });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
});

test("an old uncertain Stripe attempt requires review instead of creating another invoice", async () => {
	const flow = await setup("package");
	const q = await flow.quote();
	failSend = true;
	await flow.confirm(q);
	vi.setSystemTime(now + 24 * 60 * 60 * 1000);
	failSend = false;
	expect((await flow.confirm(q))[0]).toEqual({ reason: "INVOICE_RETRY_REQUIRES_REVIEW" });
	expect(await flow.read()).toMatchObject({ duration: "1h" });
});

test("a $299 session raised to $328 invoices $29 and shows the original $200 payment", async () => {
	const flow = await setup("booking");

	if (flow.draft.kind !== "booking") throw new Error("Expected booking");

	const bookingId = flow.draft.values.bookingId;

	await flow.t.run((ctx) => ctx.db.patch("bookings", bookingId, { duration: "2h" }));

	const draft: EditInvoiceDraft = {
		kind: "booking",
		values: { ...flow.draft.values, addons: ["Teleprompter"] }
	};

	expect(await flow.quote(draft)).toMatchObject({
		currentTotal: 299,
		total: 328,
		amount: 29,
		paidAmount: 200
	});
});

test("package session increases invoice the package while Remote Podcast stays separate", async () => {
	const flow = await setup("package");

	if (flow.draft.kind !== "package") throw new Error("Expected package");

	const packageId = flow.draft.values.packageId;

	const bookingId = await flow.t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
				...contact,
				date: "2030-01-20",
				time: "10:00",
				sessionStartAt: Date.parse("2030-01-19T23:00:00Z"),
				duration: "1h",
				service: "Table Setup",
				addons: ["Remote Podcast"],
				packageId,
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: now,
				googleEventId: "event_confirmed"
			})
		)
	);

	const draft: EditInvoiceDraft = {
		kind: "booking",
		values: {
			...contact,
			bookingId,
			date: "2030-01-20",
			time: "10:00",
			duration: "2h",
			service: "Table Setup",
			addons: ["Remote Podcast"]
		}
	};

	const q = await flow.quote(draft);

	expect(q).toMatchObject({
		target: { kind: "package", packageId },
		currentTotal: 760,
		total: 859,
		amount: 99
	});
	expect((await flow.confirm(q, draft))[0]).toBeNull();
	expect(
		await flow.staff.query(api.stripeInvoices.listStripeInvoicesForPackage, { packageId })
	).toMatchObject([null, [{ totalAmount: 99 }]]);
	expect(await flow.t.query(internal.sessions.getSessionById, { bookingId })).toMatchObject({
		duration: "2h"
	});
});

async function readDashboardPaymentAmounts(flow: Awaited<ReturnType<typeof setup>>) {
	const paginationOpts = { cursor: null, numItems: 50 };

	if (flow.draft.kind === "booking") {
		const page = await flow.staff.query(api.sessions.listSessions, { paginationOpts, view: "all" });
		const session = page.page[0];

		if (!session) throw new Error("Session missing from dashboard");

		return {
			originalPaidAmount: session.originalPaidAmount,
			paidAmount: session.paidAmount,
			invoice: session.stripeInvoicesSummary
		};
	}

	const page = await flow.staff.query(api.packages.listPackages, { paginationOpts, view: "all" });
	const packageRecord = page.page[0];

	if (!packageRecord) throw new Error("Package missing from dashboard");

	const row = mapPackageToAdminRow(packageRecord);

	return {
		originalPaidAmount: row.originalPaidAmount,
		paidAmount: row.paidAmount,
		invoice: row.customStripeInvoices
	};
}

test.each([
	{
		kind: "booking" as const,
		table: "bookings" as const,
		initialPaid: 200,
		newCharge: 99,
		fullyPaid: 299
	},
	{
		kind: "package" as const,
		table: "packages" as const,
		initialPaid: 760,
		newCharge: 376.2,
		fullyPaid: 1136.2
	}
])(
	"$kind dashboard separates money paid from unpaid invoices",
	async ({ kind, table, initialPaid, newCharge, fullyPaid }) => {
		const flow = await setup(kind);

		expect(
			(
				await flow.t.action(internal.editInvoicing.backfillOriginalPayments, {
					table,
					cursor: null
				})
			)[0]
		).toBeNull();
		expect(await readDashboardPaymentAmounts(flow)).toEqual({
			originalPaidAmount: initialPaid,
			paidAmount: initialPaid,
			invoice: null
		});
		expect((await flow.confirm(await flow.quote()))[0]).toBeNull();
		expect(await readDashboardPaymentAmounts(flow)).toEqual({
			originalPaidAmount: initialPaid,
			paidAmount: initialPaid,
			invoice: { totalAmount: newCharge, paymentStatus: "unpaid" }
		});

		const invoices =
			flow.draft.kind === "booking"
				? await flow.staff.query(api.stripeInvoices.listStripeInvoicesForBooking, {
						bookingId: flow.draft.values.bookingId
					})
				: await flow.staff.query(api.stripeInvoices.listStripeInvoicesForPackage, {
						packageId: flow.draft.values.packageId
					});

		const stripeInvoiceId = invoices[1]?.[0]?.stripeInvoiceId;

		if (!stripeInvoiceId) throw new Error("Invoice missing");

		await flow.t.mutation(internal.stripeInvoices.markStripeInvoicePaid, {
			stripeInvoiceId,
			paidAt: now
		});
		expect(await readDashboardPaymentAmounts(flow)).toEqual({
			originalPaidAmount: initialPaid,
			paidAmount: fullyPaid,
			invoice: { totalAmount: newCharge, paymentStatus: "paid" }
		});
		expect(await flow.quote()).toMatchObject({ paidAmount: fullyPaid });
	}
);

test("a cached payment remains the original payment after later price changes", async () => {
	const flow = await setup("booking");

	await flow.t.action(internal.editInvoicing.backfillOriginalPayments, {
		table: "bookings",
		cursor: null
	});
	checkoutPaid = 10000;
	await flow.t.action(internal.editInvoicing.backfillOriginalPayments, {
		table: "bookings",
		cursor: null
	});

	expect(await flow.quote()).toMatchObject({ paidAmount: 200 });
});
