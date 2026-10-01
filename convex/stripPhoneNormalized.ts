/**
 * Strip deprecated `phoneNormalized` from documents (Convex dashboard internal mutations).
 *
 * Run **before** deploying a schema that removes `phoneNormalized` and `by_phoneNormalized`.
 *
 * | Function                      | Args                 | Until          |
 * | ----------------------------- | -------------------- | -------------- |
 * | stripPackagePhoneNormalized   | `{ "cursor": null }` | `isDone: true` |
 * | stripBookingPhoneNormalized   | `{ "cursor": null }` | `isDone: true` |
 *
 * Run **packages first**, then **bookings**. Pass returned `continueCursor` as `"cursor"` until `isDone`.
 */
import { v } from "convex/values";
import { internalMutation } from "#convex/_generated/server";
import {
	stripBookingsPhoneNormalizedBatch,
	stripPackagesPhoneNormalizedBatch
} from "#convex/lib/stripPhoneNormalized";

export const stripBookingPhoneNormalized = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), batchSize: v.optional(v.number()) },
	handler: async (ctx, args) => stripBookingsPhoneNormalizedBatch(ctx, args.cursor, args.batchSize)
});

export const stripPackagePhoneNormalized = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), batchSize: v.optional(v.number()) },
	handler: async (ctx, args) => stripPackagesPhoneNormalizedBatch(ctx, args.cursor, args.batchSize)
});
