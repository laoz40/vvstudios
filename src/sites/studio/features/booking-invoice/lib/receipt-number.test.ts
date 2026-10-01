import { describe, expect, test } from "vitest";
import { formatBookingReceiptNumber } from "#studio/features/booking-invoice/lib/receipt-number";

describe("formatBookingReceiptNumber", () => {
	test("formats paid receipts as VV-yyyyMMdd-XXXX", () => {
		const paidAt = Date.parse("2025-03-27T12:00:00.000Z");

		expect(formatBookingReceiptNumber("j570tzrg60qwkdhcxgkcyv1718", paidAt)).toBe(
			"VV-20250327-1718"
		);
	});
});
