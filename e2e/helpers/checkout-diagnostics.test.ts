/**
 * Private content
 * Reports fixed categories rather than raw console or notification text.
 *
 * Known failures
 * Distinguishes common checkout failures, including Convex return serialization errors.
 */
import { describe, expect, test } from "vitest";
import { classifyCheckoutDiagnostic } from "./checkout-diagnostics";

describe("checkout diagnostic classification", () => {
	test("redacts arbitrary console and notification content", () => {
		const secret = "cus_123_secret@example.com 4242424242424242";

		expect(classifyCheckoutDiagnostic(`Convex server error: ${secret}`)).toBe("convex-error");
		expect(classifyCheckoutDiagnostic(`Something went wrong: ${secret}`)).toBe(
			"visible-notification"
		);
	});

	test("recognizes common checkout failure categories", () => {
		expect(classifyCheckoutDiagnostic("Something went wrong while starting checkout.")).toBe(
			"checkout-start-failed"
		);
		expect(classifyCheckoutDiagnostic("That time was just taken.")).toBe(
			"booking-slot-unavailable"
		);
		expect(classifyCheckoutDiagnostic("Network request failed")).toBe("network-error");
		expect(
			classifyCheckoutDiagnostic(
				'[CONVEX A(stripe:createEmbeddedCheckoutSession)] Server Error: Ok {"value":null} is not a supported Convex type.'
			)
		).toBe("convex-return-serialization-error");
	});
});
