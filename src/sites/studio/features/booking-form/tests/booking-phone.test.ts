/**
 * Canonical phone parsing for customer and admin contact input.
 *
 * 1. Australian +61 input
 *    Spaced and compact +61 mobiles normalize to a leading 0 local form.
 *
 * 2. Local 04 input
 *    Spaced local numbers normalize to digits-only local form.
 *
 * 3. Already canonical values
 *    Stored-style numbers pass through unchanged.
 *
 * 4. Invalid input
 *    Values outside the booking phone pattern are rejected before normalize.
 */
import { describe, expect, test } from "vitest";
import { parseCanonicalPhoneForStorage } from "#studio/features/booking-form/lib/booking-phone";

describe("parseCanonicalPhoneForStorage", () => {
	test("Australian +61 input", () => {
		expect(parseCanonicalPhoneForStorage("+61 434 367 184")).toBe("0434367184");
		expect(parseCanonicalPhoneForStorage("+61434367184")).toBe("0434367184");
		expect(parseCanonicalPhoneForStorage("61 434 367 184")).toBe("0434367184");
	});

	test("local 04 input", () => {
		expect(parseCanonicalPhoneForStorage("0434 367 184")).toBe("0434367184");
		expect(parseCanonicalPhoneForStorage("0400 000 000")).toBe("0400000000");
	});

	test("already canonical values", () => {
		expect(parseCanonicalPhoneForStorage("0434367184")).toBe("0434367184");
	});

	test("invalid input", () => {
		expect(() => parseCanonicalPhoneForStorage("")).toThrow(/phone/i);
		expect(() => parseCanonicalPhoneForStorage("not-a-phone")).toThrow(/phone/i);
		expect(() => parseCanonicalPhoneForStorage("12")).toThrow(/phone/i);
	});
});
