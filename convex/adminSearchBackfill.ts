/**
 * Post-deploy admin search backfill (run from Convex dashboard after PRs 2–4 merge).
 *
 * | Function                      | Args                 | Until          |
 * | ----------------------------- | -------------------- | -------------- |
 * | backfillBookingAdminSearch    | `{ "cursor": null }` | `isDone: true` |
 * | backfillPackageAdminSearch    | `{ "cursor": null }` | `isDone: true` |
 *
 * Next batch: pass returned `continueCursor` as `"cursor"`. Run packages before bookings if both exist.
 *
 * Also canonicalizes stored `phone` and refreshes `searchBlob` when contact text changes.
 */
import { v } from "convex/values";
import { internalMutation } from "#convex/_generated/server";
import {
	backfillBookingsAdminSearchBatch,
	backfillPackagesAdminSearchBatch
} from "#convex/lib/adminSearchBackfill";

export const backfillBookingAdminSearch = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), batchSize: v.optional(v.number()) },
	handler: async (ctx, args) => backfillBookingsAdminSearchBatch(ctx, args.cursor, args.batchSize)
});

export const backfillPackageAdminSearch = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), batchSize: v.optional(v.number()) },
	handler: async (ctx, args) => backfillPackagesAdminSearchBatch(ctx, args.cursor, args.batchSize)
});
