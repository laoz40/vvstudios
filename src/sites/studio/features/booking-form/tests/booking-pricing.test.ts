/**
 * Session and package price totals used in booking and admin edit flows.
 *
 * 1. Session total deltas
 *    Duration upgrades and add-ons use catalog dollar amounts.
 *
 * 2. Exclusive editing add-ons
 *    Totals charge only the add-ons present on the draft.
 *
 * 3. Receipt parity
 *    getBookingTotal matches calculateBookingReceiptAmounts for the same configuration.
 */
import { describe, expect, test } from "vitest";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { calculateBookingReceiptAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-receipt-amounts";
import { getBookingTotal } from "#studio/features/booking-form/lib/booking-pricing";

const emptyAddons: BookingAddon[] = [];

const baseSession = { duration: "1h" as const, addons: emptyAddons };

describe("getBookingTotal", () => {
	test("charges $99 more when duration moves from 1h to 2h", () => {
		const before = getBookingTotal(baseSession);

		const after = getBookingTotal({ ...baseSession, duration: "2h" });

		expect(before).toBe(200);
		expect(after).toBe(299);
		expect(after - before).toBe(99);
	});

	test("charges $29 when teleprompter is added", () => {
		const before = getBookingTotal(baseSession);

		const after = getBookingTotal({
			...baseSession,
			addons: ["Teleprompter"] satisfies BookingAddon[]
		});

		expect(after - before).toBe(29);
	});

	test("charges $200 for essential edit quantity two", () => {
		const before = getBookingTotal(baseSession);

		const after = getBookingTotal({
			...baseSession,
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "2"
		});

		expect(after - before).toBe(200);
	});

	test("charges only the selected exclusive editing tier", () => {
		const essentialOnly = getBookingTotal({
			duration: "1h",
			addons: ["Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "1"
		});

		const completeOnly = getBookingTotal({
			duration: "1h",
			addons: ["Complete Edit"] satisfies BookingAddon[],
			completeEditQuantity: "1"
		});

		expect(essentialOnly).toBe(300);
		expect(completeOnly).toBe(449);
	});
});

describe("getBookingTotal receipt parity", () => {
	test("matches receipt total paid for a two-hour session with teleprompter", () => {
		const config = { duration: "2h" as const, addons: ["Teleprompter"] satisfies BookingAddon[] };

		expect(getBookingTotal(config)).toBe(calculateBookingReceiptAmounts(config).totalPaidAmount);
		expect(getBookingTotal(config)).toBe(328);
	});
});
