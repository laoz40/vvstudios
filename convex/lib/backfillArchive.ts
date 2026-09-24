import type { PaginationResult } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { isBookingArchived, isPackageArchived } from "#convex/lib/archiveState";
import { archivePackageWhenFullyDone } from "#convex/lib/packageArchive";
import { archiveSessionWhenFullyDone } from "#convex/lib/sessionArchive";

export type ArchiveBackfillBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	newlyArchived: number;
	scanned: number;
};

export type StripHiddenAtBackfillBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	scanned: number;
	stripped: number;
};

const DEFAULT_BATCH_SIZE = 25;

/** One-off: remove deprecated hiddenAt from bookings before PR3 drops it from the schema. */
export async function backfillStripBookingHiddenAtBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE
): Promise<StripHiddenAtBackfillBatchResult> {
	const page: PaginationResult<Doc<"bookings">> = await ctx.db
		.query("bookings")
		.paginate({ cursor, numItems });

	let stripped = 0;

	await page.page.reduce(async (chain, booking) => {
		await chain;

		if (booking.hiddenAt === undefined) {
			return;
		}

		await ctx.db.patch(booking._id, { hiddenAt: undefined });
		stripped += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		stripped
	};
}

/** One-off: remove deprecated hiddenAt from packages before PR3 drops it from the schema. */
export async function backfillStripPackageHiddenAtBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE
): Promise<StripHiddenAtBackfillBatchResult> {
	const page: PaginationResult<Doc<"packages">> = await ctx.db
		.query("packages")
		.paginate({ cursor, numItems });

	let stripped = 0;

	await page.page.reduce(async (chain, packageRecord) => {
		await chain;

		if (packageRecord.hiddenAt === undefined) {
			return;
		}

		await ctx.db.patch(packageRecord._id, { hiddenAt: undefined });
		stripped += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		stripped
	};
}

export async function backfillEligibleSessionArchivesBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE,
	now = Date.now()
): Promise<ArchiveBackfillBatchResult> {
	const page: PaginationResult<Doc<"bookings">> = await ctx.db
		.query("bookings")
		.withIndex("by_archived_and_sessionStartAt", (indexQuery) => indexQuery.eq("archived", false))
		.paginate({ cursor, numItems });

	let newlyArchived = 0;

	await page.page.reduce(async (chain, booking) => {
		await chain;
		await archiveSessionWhenFullyDone(ctx, booking._id, now);

		const updated = await ctx.db.get(booking._id);

		if (updated && isBookingArchived(updated)) {
			newlyArchived += 1;
		}
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		newlyArchived,
		scanned: page.page.length
	};
}

export async function backfillEligiblePackageArchivesBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE,
	now = Date.now()
): Promise<ArchiveBackfillBatchResult> {
	const page: PaginationResult<Doc<"packages">> = await ctx.db
		.query("packages")
		.withIndex("by_archived_and_createdAt", (indexQuery) => indexQuery.eq("archived", false))
		.paginate({ cursor, numItems });

	let newlyArchived = 0;

	await page.page.reduce(async (chain, packageRecord) => {
		await chain;
		await archivePackageWhenFullyDone(ctx, packageRecord._id, now);

		const updated = await ctx.db.get(packageRecord._id);

		if (updated && isPackageArchived(updated)) {
			newlyArchived += 1;
		}
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		newlyArchived,
		scanned: page.page.length
	};
}
