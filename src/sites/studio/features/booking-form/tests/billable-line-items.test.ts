/**
 * Billable line item resolver used by checkout and admin Stripe invoices.
 *
 * 1. Duration upgrades and add-on billable lines for admin invoices.
 * 2. Session and package priced lines shared by form totals, receipts, and checkout.
 * 3. Checkout parity for a priced session configuration.
 */
import { describe, expect, test } from "vitest";
import {
	getAvailableDurationUpgradeOptions,
	getDurationUpgradePerSessionAmount,
	getPackagePriceSubtotalBeforeDiscount,
	getSessionPriceAmounts,
	buildAddonBillableLine,
	buildAddonPricedLine,
	buildDurationUpgradeBillableLine,
	buildStudioHirePricedLine
} from "#studio/features/booking-form/lib/billable-line-items";
import { getBookingTotal } from "#studio/features/booking-form/lib/booking-pricing";
import { buildSessionCheckoutLineItems } from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";

const sessionScope = { sessionCount: 1 as const };

const packageScope = { sessionCount: 8 as const };

describe("getDurationUpgradePerSessionAmount", () => {
	test("returns the list price difference for upgrades", () => {
		expect(getDurationUpgradePerSessionAmount("1h", "2h")).toBe(99);
		expect(getDurationUpgradePerSessionAmount("2h", "3h")).toBe(100);
	});

	test("rejects downgrades and same duration", () => {
		expect(getDurationUpgradePerSessionAmount("2h", "1h")).toBeNull();
		expect(getDurationUpgradePerSessionAmount("2h", "2h")).toBeNull();
	});
});

describe("buildDurationUpgradeBillableLine", () => {
	test("charges the session price difference when upgrading duration", () => {
		expect(buildDurationUpgradeBillableLine(sessionScope, "2h", "3h", false)).toEqual({
			description: "Studio hire upgrade: 2h to 3h",
			amount: 100
		});
	});

	test("applies the duration difference across every package session when checked", () => {
		expect(buildDurationUpgradeBillableLine(packageScope, "2h", "3h", true)).toEqual({
			description: "Studio hire upgrade (8 sessions): 2h to 3h",
			amount: 800
		});
	});
});

describe("buildAddonBillableLine", () => {
	test("multiplies quantity by package size when apply to every session is checked", () => {
		expect(buildAddonBillableLine(packageScope, "Essential Edit", 2, true)).toEqual({
			description: "Rough Cut x16 (8 sessions)",
			amount: 1600
		});
	});
});

describe("buildStudioHirePricedLine", () => {
	test("matches checkout studio hire unit pricing", () => {
		expect(buildStudioHirePricedLine("2h", 1)).toEqual({
			description: "Studio Hire (2h)",
			unitAmount: 299,
			quantity: 1,
			amount: 299
		});
	});
});

describe("buildAddonPricedLine", () => {
	test("matches checkout add-on unit pricing", () => {
		expect(buildAddonPricedLine("Teleprompter", 1)).toEqual({
			description: "Teleprompter",
			unitAmount: 29,
			quantity: 1,
			amount: 29
		});
	});
});

describe("getAvailableDurationUpgradeOptions", () => {
	test("returns only longer durations than the current booking", () => {
		expect(getAvailableDurationUpgradeOptions("1h")).toEqual(["2h", "3h"]);
		expect(getAvailableDurationUpgradeOptions("3h")).toEqual([]);
	});
});

describe("getSessionPriceAmounts", () => {
	test("matches a two-hour session with teleprompter at list price", () => {
		expect(
			getSessionPriceAmounts({ duration: "2h", addons: ["Teleprompter"], addonQuantity: () => 1 })
		).toEqual({ baseAmount: 299, addonsAmount: 29, subtotalAmount: 328 });
	});
});

describe("getPackagePriceSubtotalBeforeDiscount", () => {
	test("matches eight sessions of a two-hour booking before discount", () => {
		expect(
			getPackagePriceSubtotalBeforeDiscount({
				duration: "2h",
				packageSize: 8,
				addons: [],
				addonQuantityPerSession: () => 1
			})
		).toBe(2392);
	});
});

describe("session price subtotal and checkout", () => {
	test("matches the Stripe checkout total for the same session", () => {
		const config = { duration: "2h" as const, addons: ["Teleprompter"] as const };

		const sessionPrice = getSessionPriceAmounts({
			duration: config.duration,
			addons: [...config.addons],
			addonQuantity: () => 1
		});

		const checkout = buildSessionCheckoutLineItems({ ...config, addons: [...config.addons] });

		expect(checkout.isOk()).toBe(true);

		if (checkout.isOk()) {
			const checkoutTotal = checkout.value.reduce(
				(total, item) => total + (item.price_data.unit_amount * item.quantity) / 100,
				0
			);

			expect(checkoutTotal).toBe(sessionPrice.subtotalAmount);
		}

		expect(getBookingTotal({ ...config, addons: [...config.addons] })).toBe(328);
	});
});

describe("duration upgrade and full booking price", () => {
	test("one-hour checkout plus a two-hour upgrade invoice equals the two-hour booking total", () => {
		const paidAtCheckout = getBookingTotal({ duration: "1h", addons: [] });

		const upgradeLineItem = buildDurationUpgradeBillableLine(sessionScope, "1h", "2h", false);

		const fullTwoHourPrice = getBookingTotal({ duration: "2h", addons: [] });

		expect(paidAtCheckout).toBe(200);
		expect(upgradeLineItem).toEqual({ description: "Studio hire upgrade: 1h to 2h", amount: 99 });
		expect(paidAtCheckout + (upgradeLineItem?.amount ?? 0)).toBe(fullTwoHourPrice);
	});
});
