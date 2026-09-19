/**
 * Upfront payment totals must match between Stripe checkout and booking receipts.
 *
 * 1. Single session parity
 *    Receipt total paid must equal the Stripe checkout total for the same booking.
 *
 * 2. Session with add-ons
 *    Quantity-based add-ons must charge the same amount at checkout and on the receipt.
 *
 * 3. Package checkout parity
 *    Package checkout totals must match stored package pricing for the same configuration.
 */
import { describe, expect, test } from "vitest";
import {
	buildPackageCheckoutLineItems,
	buildSessionCheckoutLineItems,
	type PackageCheckoutLineItems,
	type SessionCheckoutLineItem
} from "#convex/lib/stripeCheckoutLineItems";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { calculateBookingReceiptAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-receipt-amounts";

const SESSION_1H_TOTAL_DOLLARS = 200;

const SESSION_2H_WITH_TELEPROMPTER_TOTAL_DOLLARS = 328;

const SESSION_1H_WITH_ESSENTIAL_EDIT_TOTAL_DOLLARS = 300;

const PACKAGE_8_SESSION_TOTAL_DOLLARS = 3225.6;

function sessionCheckoutTotalDollars(lineItems: SessionCheckoutLineItem[]) {
	return lineItems.reduce((total, item) => {
		return total + (item.price_data.unit_amount * item.quantity) / 100;
	}, 0);
}

function packageCheckoutTotalDollars(checkout: PackageCheckoutLineItems) {
	const subtotal = checkout.lineItems.reduce((total, item) => {
		return total + (item.price_data.unit_amount * item.quantity) / 100;
	}, 0);

	return subtotal - checkout.discount.amount;
}

describe("session receipt and checkout totals", () => {
	test("charges $200 for a one-hour session at checkout and on the receipt", () => {
		const checkout = buildSessionCheckoutLineItems({ duration: "1h", addons: [] });
		const receipt = calculateBookingReceiptAmounts({ duration: "1h", addons: [] });

		expect(checkout.isOk()).toBe(true);

		if (checkout.isOk()) {
			expect(sessionCheckoutTotalDollars(checkout.value)).toBe(SESSION_1H_TOTAL_DOLLARS);
		}

		expect(receipt.totalPaidAmount).toBe(SESSION_1H_TOTAL_DOLLARS);
	});

	test("charges $328 for a two-hour session with teleprompter", () => {
		const checkout = buildSessionCheckoutLineItems({
			duration: "2h",
			addons: ["Teleprompter"] satisfies BookingAddon[]
		});

		const receipt = calculateBookingReceiptAmounts({
			duration: "2h",
			addons: ["Teleprompter"] satisfies BookingAddon[]
		});

		expect(checkout.isOk()).toBe(true);

		if (checkout.isOk()) {
			expect(sessionCheckoutTotalDollars(checkout.value)).toBe(
				SESSION_2H_WITH_TELEPROMPTER_TOTAL_DOLLARS
			);
		}

		expect(receipt.totalPaidAmount).toBe(SESSION_2H_WITH_TELEPROMPTER_TOTAL_DOLLARS);
	});

	test("charges $300 for a one-hour session with one essential edit", () => {
		const checkout = buildSessionCheckoutLineItems({
			duration: "1h",
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "1"
		});

		const receipt = calculateBookingReceiptAmounts({
			duration: "1h",
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "1"
		});

		expect(checkout.isOk()).toBe(true);

		if (checkout.isOk()) {
			expect(sessionCheckoutTotalDollars(checkout.value)).toBe(
				SESSION_1H_WITH_ESSENTIAL_EDIT_TOTAL_DOLLARS
			);
		}

		expect(receipt.totalPaidAmount).toBe(SESSION_1H_WITH_ESSENTIAL_EDIT_TOTAL_DOLLARS);
	});
});

describe("package checkout and stored pricing totals", () => {
	test("charges $3225.60 for an eight-session package with 4K recording", () => {
		const packageInput = {
			duration: "3h" as const,
			packageSize: 8 as const,
			addons: ["4K UHD Recording"] satisfies BookingAddon[]
		};

		const checkout = buildPackageCheckoutLineItems(packageInput);
		const packageAmounts = calculatePackageAmounts(packageInput);

		expect(checkout.isOk()).toBe(true);

		if (checkout.isOk()) {
			expect(packageCheckoutTotalDollars(checkout.value)).toBe(PACKAGE_8_SESSION_TOTAL_DOLLARS);
		}

		expect(packageAmounts.totalDueAmount).toBe(PACKAGE_8_SESSION_TOTAL_DOLLARS);
	});
});
