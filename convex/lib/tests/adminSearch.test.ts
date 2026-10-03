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
import { parseAdminSearchQuery } from "#convex/lib/adminSearch/adminSearchQuery";
import {
	instagramHandleMatchesQuery,
	normalizeAbn,
	normalizePhone
} from "#convex/lib/contactNormalization";

describe("contactNormalization", () => {
	test("normalizePhone", () => {
		expect(normalizePhone("+61 434 367 184")).toBe("0434367184");
		expect(normalizePhone(" 0434 367 184 ")).toBe("0434367184");
		expect(normalizePhone("0434367184")).toBe("0434367184");
	});

	test("normalizeAbn", () => {
		expect(normalizeAbn("12 345 678 901")).toBe("12345678901");
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

	test("phone prefix", () => {
		expect(parseAdminSearchQuery("phone:+61 434 367 184")).toEqual({
			kind: "phone",
			value: "+61 434 367 184"
		});
	});
});
