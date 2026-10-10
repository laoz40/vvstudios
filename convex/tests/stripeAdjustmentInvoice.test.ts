/**
 * Package adjustment invoices retain their billing and retry behavior across Stripe failures.
 *
 * 1. Delivery
 *    Remote Podcast invoices retain their price, quantity, metadata, and idempotency keys.
 *    Existing products are reused; missing products are created with the adjustment metadata.
 *
 * 2. Failure recovery
 *    Every Stripe operation preserves its domain error and leaves delivery retryable.
 *    Unexpected SDK failures return the existing fallback reason without sending an invoice.
 *    Missing Stripe customers fail before any invoice is created.
 */
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";
import { packageDocument } from "#convex/tests/insertDocumentDefaults";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const adminIdentity = { publicMetadata: { role: "admin" } };

type StripeRequest = {
	method: string;
	path: string;
	params?: unknown;
	options?: { idempotencyKey?: string };
};

let requests: StripeRequest[];

let rejectPath: string | undefined;

let rejectUnexpected = false;

let noExistingProduct = false;

beforeEach(() => {
	requests = [];
	rejectPath = undefined;
	rejectUnexpected = false;
	noExistingProduct = false;
	vi.useFakeTimers();
	vi.setSystemTime(now);
	vi.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(
		(method, path, params, options) => {
			requests.push({ method, path, params, options });

			if (path === rejectPath) {
				return Promise.reject(
					new Stripe.errors.StripeInvalidRequestError({
						message: "Rejected",
						code: "resource_missing"
					})
				);
			}

			if (rejectUnexpected && path === "/v1/products/search") {
				return Promise.reject(new Error("Network disconnected"));
			}

			if (path === "/v1/products/search") {
				return Promise.resolve({ data: noExistingProduct ? [] : [{ id: "prod_existing" }] });
			}

			if (path === "/v1/invoices") return Promise.resolve({ id: "in_draft" });

			if (path === "/v1/products") return Promise.resolve({ id: "prod_created" });

			if (path === "/v1/invoiceitems") return Promise.resolve({ id: "ii_adjustment" });

			if (path === "/v1/invoices/in_draft/finalize") return Promise.resolve({ id: "in_finalized" });

			if (path === "/v1/invoices/in_finalized/send") return Promise.resolve({ id: "in_finalized" });
			throw new Error(`Unexpected Stripe request: ${method} ${path}`);
		}
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("package adjustment Stripe delivery", () => {
	test("sends an invoice with the adjustment terms and stable retry keys", async () => {
		const t = createConvexTest();
		const { adjustmentId, packageId } = await seedAdjustment(t);

		expect(await sendInvoice(t, adjustmentId)).toEqual([null, null]);
		expect(requests).toEqual([
			{
				method: "POST",
				path: "/v1/invoices",
				params: {
					customer: "cus_adjustment",
					collection_method: "send_invoice",
					days_until_due: 7,
					metadata: { adjustmentId, packageId }
				},
				options: { idempotencyKey: `package-adjustment-invoice-create-${adjustmentId}` }
			},
			{
				method: "GET",
				path: "/v1/products/search",
				params: {
					query: "metadata['kind']:'package_adjustment_remote_podcast' AND active:'true'",
					limit: 1
				}
			},
			{
				method: "POST",
				path: "/v1/invoiceitems",
				params: {
					customer: "cus_adjustment",
					invoice: "in_draft",
					quantity: 2,
					price_data: { currency: "aud", product: "prod_existing", unit_amount: 5900 },
					description: "Remote Podcast (package adjustment)"
				},
				options: { idempotencyKey: `package-adjustment-invoice-item-${adjustmentId}` }
			},
			{
				method: "POST",
				path: "/v1/invoices/in_draft/finalize",
				params: undefined,
				options: { idempotencyKey: `package-adjustment-invoice-finalize-${adjustmentId}` }
			},
			{
				method: "POST",
				path: "/v1/invoices/in_finalized/send",
				params: undefined,
				options: { idempotencyKey: `package-adjustment-invoice-send-${adjustmentId}` }
			}
		]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailStatus: "sent",
			stripeInvoiceId: "in_finalized"
		});
	});

	test("creates a Remote Podcast product when Stripe has no active adjustment product", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedAdjustment(t);
		noExistingProduct = true;

		expect(await sendInvoice(t, adjustmentId)).toEqual([null, null]);
		expect(requests).toContainEqual({
			method: "POST",
			path: "/v1/products",
			params: { name: "Remote Podcast", metadata: { kind: "package_adjustment_remote_podcast" } },
			options: undefined
		});
		const invoiceItemRequest = requests.find(({ path }) => path === "/v1/invoiceitems");
		expect(invoiceItemRequest).toMatchObject({
			params: { price_data: { currency: "aud", product: "prod_created", unit_amount: 5900 } }
		});
	});

	test.each([
		["invoice creation", "/v1/invoices"],
		["product search", "/v1/products/search"],
		["product creation", "/v1/products"],
		["invoice item creation", "/v1/invoiceitems"],
		["finalization", "/v1/invoices/in_draft/finalize"],
		["sending", "/v1/invoices/in_finalized/send"]
	])("preserves Stripe errors and allows retry after %s fails", async (_operation, path) => {
		const t = createConvexTest();
		const { adjustmentId } = await seedAdjustment(t);

		if (path === "/v1/products") noExistingProduct = true;

		rejectPath = path;

		expect(await sendInvoice(t, adjustmentId)).toEqual([
			{ reason: "STRIPE_RESOURCE_MISSING" },
			null
		]);
		const failedAdjustment = await readAdjustment(t, adjustmentId);
		expect(failedAdjustment).toMatchObject({ invoiceEmailStatus: "failed" });
		expect(failedAdjustment).not.toHaveProperty("invoiceEmailClaimedAt");
		expect(failedAdjustment).not.toHaveProperty("stripeInvoiceId");

		rejectPath = undefined;
		expect(
			await t
				.withIdentity(adminIdentity)
				.action(api.packages.adjustmentInvoices.retryPackageAdjustmentInvoiceEmail, {
					adjustmentId
				})
		).toEqual([null, null]);
		expect(await readAdjustment(t, adjustmentId)).toMatchObject({
			invoiceEmailStatus: "sent",
			stripeInvoiceId: "in_finalized"
		});
	});

	test("returns the Stripe fallback reason for an unexpected SDK failure", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedAdjustment(t);
		vi.spyOn(console, "error").mockImplementation(() => {});
		rejectUnexpected = true;

		expect(await sendInvoice(t, adjustmentId)).toEqual([{ reason: "STRIPE_API_FAILED" }, null]);
		const failedAdjustment = await readAdjustment(t, adjustmentId);
		expect(failedAdjustment).toMatchObject({ invoiceEmailStatus: "failed" });
		expect(failedAdjustment).not.toHaveProperty("stripeInvoiceId");
	});

	test("records missing Stripe customers as a failed delivery", async () => {
		const t = createConvexTest();
		const { adjustmentId } = await seedAdjustment(t, {});

		expect(await sendInvoice(t, adjustmentId)).toEqual([
			{ reason: "STRIPE_CUSTOMER_NOT_FOUND" },
			null
		]);
		const failedAdjustment = await readAdjustment(t, adjustmentId);
		expect(failedAdjustment).toMatchObject({ invoiceEmailStatus: "failed" });
		expect(failedAdjustment).not.toHaveProperty("stripeInvoiceId");
	});
});

type TestClient = ReturnType<typeof createConvexTest>;

async function seedAdjustment(
	t: TestClient,
	{ stripeCustomerId }: { stripeCustomerId?: string } = { stripeCustomerId: "cus_adjustment" }
) {
	const packageId = await t.run((ctx) =>
		ctx.db.insert(
			"packages",
			packageDocument({
				name: "Invoice customer",
				phone: "0400000000",
				accountName: "Invoice account",
				email: "invoice@example.com",
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
				createdAt: now,
				paidAt: now,
				receiptEmailStatus: "sent",
				stripeCustomerId
			})
		)
	);

	const adjustmentId = await t.run((ctx) =>
		ctx.db.insert("packageAdjustments", {
			outcome: "invoice_required",
			packageId,
			trigger: "package_expired",
			remotePodcastBookingIds: [],
			quantity: 2,
			rate: 59,
			totalAmount: 118,
			invoiceNumber: "TEST-ADJ-1",
			createdAt: now,
			invoiceDueAt: now + 7 * 24 * 60 * 60 * 1000,
			invoiceEmailStatus: "pending",
			paymentStatus: "unpaid"
		})
	);

	return { packageId, adjustmentId };
}

function sendInvoice(t: TestClient, adjustmentId: Id<"packageAdjustments">) {
	return t.action(internal.packages.adjustmentInvoices.sendPackageAdjustmentInvoice, {
		adjustmentId,
		attempt: "automatic"
	});
}

function readAdjustment(t: TestClient, adjustmentId: Id<"packageAdjustments">) {
	return t.run((ctx) => ctx.db.get("packageAdjustments", adjustmentId));
}
