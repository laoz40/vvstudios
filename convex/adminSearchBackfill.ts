/**
 * Post-deploy admin search backfill (Convex dashboard internal mutations).
 *
 * | Function                   | Args                 | Until          |
 * | -------------------------- | -------------------- | -------------- |
 * | backfillPackageAdminSearch | `{ "cursor": null }` | `isDone: true` |
 * | backfillBookingAdminSearch | `{ "cursor": null }` | `isDone: true` |
 *
 * Run **packages first**, then **bookings**. Pass returned `continueCursor` as `"cursor"` until `isDone`.
 *
 * After deploy (canonical phone + search): run both again even if launch backfill already ran.
 * Patches canonical `phone`, `searchBlob`, receipts, and `assignedEditorDisplayName` where needed.
 * `phone:` search and admin editor labels depend on stored booking fields after this pass.
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
