/**
 * Package admin update pricing snapshots from buildPackageUpdatePatch.
 *
 * 1. Quantity add-ons
 *    Essential edit quantity flows into per-session and package totals.
 *
 * 2. Discount tiers
 *    Four, eight, and twelve session packages apply the correct discount percent.
 *
 * 3. Invoice integrity
 *    Line item amounts sum to totalDueAmount.
 */
import { describe, expect, test } from "vitest";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { buildPackageUpdatePatch, parsePackageUpdate } from "#convex/lib/packageUpdates";
import { testPackageId } from "#convex/lib/tests/testIds";

const packageId = testPackageId("package-1");

function buildPatchFromArgs(args: Parameters<typeof parsePackageUpdate>[0]) {
	const parsed = parsePackageUpdate(args);

	if (parsed.isErr()) {
		throw new Error("Expected valid package update args");
	}

	return buildPackageUpdatePatch(args, parsed.value);
}

function sumLineItems(lineItems: { amount: number }[] | undefined) {
	return lineItems?.reduce((total, item) => total + item.amount, 0) ?? 0;
}

describe("buildPackageUpdatePatch", () => {
	test("prices essential edit quantity two on a four-session package", () => {
		const args = {
			packageId,
			name: "Package customer",
			phone: "0400000000",
			accountName: "Account",
			email: "customer@example.com",
			duration: "1h",
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "2",
			packageSize: 4 as const
		};

		const patch = buildPatchFromArgs(args);

		expect(patch).toMatchObject({
			singleSessionAmount: 400,
			packageSubtotalAmount: 1600,
			discountPercent: 5,
			discountAmount: 80,
			totalDueAmount: 1520,
			invoiceLineItems: [
				{ amount: 800, description: "Studio Hire (1h)", quantity: 4, rate: 200 },
				{ amount: 800, description: "Rough Cut add-on", quantity: 8, rate: 100 },
				{ amount: -80, description: "5% package discount", quantity: 1, rate: -80 }
			]
		});
		expect(sumLineItems(patch.invoiceLineItems)).toBe(1520);
	});

	test("applies a five percent discount on a four-session one-hour package", () => {
		const patch = buildPatchFromArgs({
			packageId,
			name: "Package customer",
			phone: "0400000000",
			accountName: "Account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4
		});

		expect(patch.discountPercent).toBe(5);
		expect(patch.discountAmount).toBe(40);
		expect(patch.totalDueAmount).toBe(760);
		expect(sumLineItems(patch.invoiceLineItems)).toBe(760);
	});

	test("applies a ten percent discount on an eight-session one-hour package", () => {
		const patch = buildPatchFromArgs({
			packageId,
			name: "Package customer",
			phone: "0400000000",
			accountName: "Account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 8
		});

		expect(patch.discountPercent).toBe(10);
		expect(patch.discountAmount).toBe(160);
		expect(patch.totalDueAmount).toBe(1440);
		expect(sumLineItems(patch.invoiceLineItems)).toBe(1440);
	});

	test("applies a fifteen percent discount on a twelve-session one-hour package", () => {
		const patch = buildPatchFromArgs({
			packageId,
			name: "Package customer",
			phone: "0400000000",
			accountName: "Account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 12
		});

		expect(patch.discountPercent).toBe(15);
		expect(patch.discountAmount).toBe(360);
		expect(patch.totalDueAmount).toBe(2040);
		expect(sumLineItems(patch.invoiceLineItems)).toBe(2040);
	});
});
