/**
 * toConvexTuple tests:
 *
 * 1. Ok result
 *    Serializes to [null, value].
 * 2. Err result
 *    Serializes to [error, null] with the original reason.
 */
import { errAsync, okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";
import { toConvexTuple } from "#convex/lib/result";

describe("toConvexTuple", () => {
	test("serializes an ok result", async () => {
		expect(await toConvexTuple(okAsync(null))).toEqual([null, null]);
	});

	test("serializes an err result with its reason", async () => {
		expect(await toConvexTuple(errAsync({ reason: "EMAIL_REQUEST_FAILED" as const }))).toEqual([
			{ reason: "EMAIL_REQUEST_FAILED" },
			null
		]);
	});
});
