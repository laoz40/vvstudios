/**
 * Session Stripe checkout line item pricing.
 *
 * 1. Cents conversion
 *    AUD dollar amounts map to Stripe unit_amount in cents.
 *
 * 2. Zero-quantity omission
 *    Quantity-tracked add-ons with no quantity are excluded from line items.
 *
 * 3. Invalid duration
 *    Returns BOOKING_INVALID_DURATION.
 */
import { describe, expect, test } from "vitest";
import { buildSessionCheckoutLineItems } from "#convex/lib/stripeCheckoutLineItems";

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
