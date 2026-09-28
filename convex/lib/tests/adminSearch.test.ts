/**
 * Admin search helpers.
 *
 * 1. normalizePhone
 *    Strips formatting and normalizes Australian +61 numbers to a leading 0.
 *
 * 2. parseAdminSearchQuery
 *    Parses field:value admin queries or unprefixed blob text.
 */
import { describe, expect, test } from "vitest";
import { parseAdminSearchQuery } from "#convex/lib/adminSearchQuery";
import {
	contactNormalizedIndexFields,
	instagramHandleMatchesQuery,
	normalizeAbn,
	normalizePhone
} from "#convex/lib/contactNormalization";

describe("contactNormalization", () => {
	test("normalizePhone", () => {
		expect(normalizePhone("+61 434 367 184")).toBe("0434367184");
		expect(normalizePhone("0434 367 184")).toBe("0434367184");
	});

	test("normalizeAbn", () => {
		expect(normalizeAbn("12 345 678 901")).toBe("12345678901");
	});

	test("contactNormalizedIndexFields", () => {
		expect(contactNormalizedIndexFields("+61 434 367 184")).toEqual({
			phoneNormalized: "0434367184"
		});
		expect(contactNormalizedIndexFields("0400 000 000")).toEqual({ phoneNormalized: "0400000000" });
	});

	test("instagramHandleMatchesQuery is partial and case-insensitive", () => {
		expect(instagramHandleMatchesQuery("MyPodcast", "pod")).toBe(true);
		expect(instagramHandleMatchesQuery("MyPodcast", "mypodcast")).toBe(true);
		expect(instagramHandleMatchesQuery("MyPodcast", "@MyPodcast")).toBe(true);
	});
});

describe("parseAdminSearchQuery", () => {
	test("unprefixed blob", () => {
		expect(parseAdminSearchQuery("acme studio")).toEqual({ kind: "blob", text: "acme studio" });
	});

	test("email prefix", () => {
		expect(parseAdminSearchQuery("email:User@Example.com")).toEqual({
			kind: "email",
			value: "user@example.com"
		});
	});

	test("ig prefix strips leading @", () => {
		expect(parseAdminSearchQuery("ig:@MyPodcast")).toEqual({ kind: "ig", value: "MyPodcast" });
	});

	test("unknown prefix stays blob", () => {
		expect(parseAdminSearchQuery("foo:bar")).toEqual({ kind: "blob", text: "foo:bar" });
	});
});
