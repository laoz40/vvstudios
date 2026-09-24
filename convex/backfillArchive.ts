import { v } from "convex/values";
import { internalMutation } from "#convex/_generated/server";
import {
	backfillEligiblePackageArchivesBatch,
	backfillEligibleSessionArchivesBatch,
	backfillStripBookingHiddenAtBatch,
	backfillStripPackageHiddenAtBatch
} from "#convex/lib/backfillArchive";

const batchResultValidator = v.object({
	continueCursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
	newlyArchived: v.number(),
	scanned: v.number()
});

const stripHiddenAtBatchResultValidator = v.object({
	continueCursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
	scanned: v.number(),
	stripped: v.number()
});

/** One-off prod helper: archive inbox sessions that already match auto-archive "fully done" rules. */
export const backfillEligibleSessionArchives = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: batchResultValidator,
	handler: async (ctx, args) =>
		backfillEligibleSessionArchivesBatch(ctx, args.cursor, args.numItems ?? undefined)
});

/** One-off prod helper: archive inbox packages that already match auto-archive "fully done" rules. */
export const backfillEligiblePackageArchives = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: batchResultValidator,
	handler: async (ctx, args) =>
		backfillEligiblePackageArchivesBatch(ctx, args.cursor, args.numItems ?? undefined)
});

/** One-off: strip deprecated hiddenAt from every booking. Required before PR3 schema deploy. */
export const backfillStripBookingHiddenAt = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: stripHiddenAtBatchResultValidator,
	handler: async (ctx, args) =>
		backfillStripBookingHiddenAtBatch(ctx, args.cursor, args.numItems ?? undefined)
});

/** One-off: strip deprecated hiddenAt from every package. Required before PR3 schema deploy. */
export const backfillStripPackageHiddenAt = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: stripHiddenAtBatchResultValidator,
	handler: async (ctx, args) =>
		backfillStripPackageHiddenAtBatch(ctx, args.cursor, args.numItems ?? undefined)
});
