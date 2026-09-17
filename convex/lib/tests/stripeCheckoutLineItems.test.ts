/**
 * Stripe checkout line item pricing for sessions and packages.
 *
 * 1. Cents conversion
 *    AUD dollar amounts map to Stripe unit_amount in cents.
 *
 * 2. Zero-quantity omission
 *    Quantity-tracked add-ons with no quantity are excluded from line items.
 *
 * 3. Invalid duration
 *    Returns BOOKING_INVALID_DURATION.
 *
 * 4. Package totals
 *    An 8-session package with add-ons applies the 10% discount to known subtotals.
 */
import { describe, expect, test } from "vitest";
import {
	buildPackageCheckoutLineItems,
	buildSessionCheckoutLineItems
} from "#convex/lib/stripeCheckoutLineItems";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";

describe("buildSessionCheckoutLineItems", () => {
	test("converts AUD prices to Stripe cents", () => {
		const result = buildSessionCheckoutLineItems({ duration: "1h", addons: [] });

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value[0]?.price_data).toEqual({
				currency: "aud",
				unit_amount: 20_000,
				product_data: { name: "Studio Hire (1h)" }
			});
		}
	});

	test("omits add-ons with zero quantity", () => {
		const result = buildSessionCheckoutLineItems({
			duration: "1h",
			addons: ["Essential Edit", "Teleprompter"]
		});

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value).toHaveLength(2);
			expect(result.value.map((item) => item.price_data.product_data.name)).toEqual([
				"Studio Hire (1h)",
				"Teleprompter"
			]);
		}
	});

	test("rejects an invalid duration", () => {
		const result = buildSessionCheckoutLineItems({ duration: "4h", addons: [] });

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_INVALID_DURATION" });
		}
	});
});

describe("buildPackageCheckoutLineItems", () => {
	test("itemizes duration and add-ons across package size", () => {
		const input = {
			duration: "2h" as const,
			packageSize: 4 as const,
			addons: ["Teleprompter", "Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "1"
		};

		const result = buildPackageCheckoutLineItems(input);

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value.lineItems).toEqual([
				{
					quantity: 4,
					price_data: {
						currency: "aud",
						unit_amount: 29_900,
						product_data: { name: "Studio Hire (2h)" }
					}
				},
				{
					quantity: 4,
					price_data: {
						currency: "aud",
						unit_amount: 2_900,
						product_data: { name: "Teleprompter" }
					}
				},
				{
					quantity: 4,
					price_data: { currency: "aud", unit_amount: 10_000, product_data: { name: "Rough Cut" } }
				}
			]);
			expect(result.value.discount).toEqual({ amount: 85.6, description: "5% package discount" });
		}
	});

	test("applies a 10% discount to an 8-session package subtotal", () => {
		const result = buildPackageCheckoutLineItems({
			duration: "3h",
			packageSize: 8,
			addons: ["4K UHD Recording"] satisfies BookingAddon[]
		});

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			expect(result.value.lineItems).toEqual([
				{
					quantity: 8,
					price_data: {
						currency: "aud",
						unit_amount: 39_900,
						product_data: { name: "Studio Hire (3h)" }
					}
				},
				{
					quantity: 8,
					price_data: {
						currency: "aud",
						unit_amount: 4_900,
						product_data: { name: "4K UHD Recording" }
					}
				}
			]);
			expect(result.value.discount).toEqual({
				amount: 358.4,
				description: "10% package discount"
			});
		}
	});

	test("rejects an invalid duration", () => {
		const result = buildPackageCheckoutLineItems({ duration: "4h", packageSize: 4, addons: [] });

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_INVALID_DURATION" });
		}
	});
});
