// Tuple success
// Preserves the value returned by a Convex function.
// Tuple failure
// Preserves a serialized domain error.
// Infrastructure failure
// Leaves unexpected promise rejections as rejections.
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";
import { fromConvexTuple } from "#convex/shared/lib/result";

describe("Convex tuple conversion", () => {
	it("returns a successful Convex value", async () => {
		const result = await fromConvexTuple(
			Promise.resolve([null, { bookingId: "booking-123" }] as const)
		);

		expect(result).toEqual(ok({ bookingId: "booking-123" }));
	});

	it("returns the original domain error", async () => {
		const result = await fromConvexTuple(
			Promise.resolve([{ reason: "BOOKING_NOT_FOUND", bookingId: "missing" }, null] as const)
		);

		expect(result).toEqual(err({ reason: "BOOKING_NOT_FOUND", bookingId: "missing" }));
	});

	it("propagates an unexpected rejection", async () => {
		const failure = new Error("Convex request failed");
		const result = fromConvexTuple(Promise.reject(failure));

		await expect(Promise.resolve(result)).rejects.toBe(failure);
	});
});
