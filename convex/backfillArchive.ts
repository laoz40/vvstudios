import { v } from "convex/values";
import { internalMutation } from "#convex/_generated/server";
import {
	backfillBookingArchivedFieldBatch,
	backfillEligiblePackageArchivesBatch,
	backfillEligibleSessionArchivesBatch,
	backfillPackageArchivedFieldBatch
} from "#convex/lib/backfillArchive";

const batchResultValidator = v.object({
	continueCursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
	newlyArchived: v.number(),
	scanned: v.number()
});

const archivedFieldBatchResultValidator = v.object({
	continueCursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
	scanned: v.number(),
	updated: v.number()
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

/** Copy hiddenAt presence into optional archived on every booking (run after deploy, before PR2). */
export const backfillBookingArchivedField = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: archivedFieldBatchResultValidator,
	handler: async (ctx, args) =>
		backfillBookingArchivedFieldBatch(ctx, args.cursor, args.numItems ?? undefined)
});

/** Copy hiddenAt presence into optional archived on every package (run after deploy, before PR2). */
export const backfillPackageArchivedField = internalMutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	returns: archivedFieldBatchResultValidator,
	handler: async (ctx, args) =>
		backfillPackageArchivedFieldBatch(ctx, args.cursor, args.numItems ?? undefined)
});
