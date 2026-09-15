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
 *    Itemized lines plus discount metadata match calculatePackageAmounts.
 */
import { describe, expect, test } from "vitest";
import {
	buildPackageCheckoutLineItems,
	buildSessionCheckoutLineItems,
	type SessionCheckoutLineItem
} from "#convex/lib/stripeCheckoutLineItems";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";

function sumLineItemsAud(lineItems: SessionCheckoutLineItem[]) {
	return lineItems.reduce((total, item) => {
		return total + (item.quantity * item.price_data.unit_amount) / 100;
	}, 0);
}

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

	test("matches calculatePackageAmounts total after discount", () => {
		const input = {
			duration: "3h" as const,
			packageSize: 8 as const,
			addons: ["4K UHD Recording"] satisfies BookingAddon[]
		};

		const result = buildPackageCheckoutLineItems(input);
		const packageAmounts = calculatePackageAmounts({ ...input, addons: [...input.addons] });

		expect(result.isOk()).toBe(true);

		if (result.isOk()) {
			const subtotal = sumLineItemsAud(result.value.lineItems);
			const discountAmount = result.value.discount.amount;

			expect(subtotal - discountAmount).toBe(packageAmounts.totalDueAmount);
			expect(result.value.discount).toEqual({
				amount: packageAmounts.discountAmount,
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
