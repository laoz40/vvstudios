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

export type ArchivedFieldBackfillBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	scanned: number;
	updated: number;
};

const DEFAULT_BATCH_SIZE = 25;

export async function backfillEligibleSessionArchivesBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE,
	now = Date.now()
): Promise<ArchiveBackfillBatchResult> {
	const page: PaginationResult<Doc<"bookings">> = await ctx.db
		.query("bookings")
		.withIndex("by_hiddenAt_and_sessionStartAt", (indexQuery) =>
			indexQuery.eq("hiddenAt", undefined)
		)
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

export async function backfillBookingArchivedFieldBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE
): Promise<ArchivedFieldBackfillBatchResult> {
	const page: PaginationResult<Doc<"bookings">> = await ctx.db
		.query("bookings")
		.paginate({ cursor, numItems });

	let updated = 0;

	await page.page.reduce(async (chain, booking) => {
		await chain;

		if (booking.archived !== undefined) {
			return;
		}

		await ctx.db.patch(booking._id, { archived: booking.hiddenAt !== undefined });
		updated += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		updated
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
		.withIndex("by_hiddenAt_and_createdAt", (indexQuery) => indexQuery.eq("hiddenAt", undefined))
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

export async function backfillPackageArchivedFieldBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = DEFAULT_BATCH_SIZE
): Promise<ArchivedFieldBackfillBatchResult> {
	const page: PaginationResult<Doc<"packages">> = await ctx.db
		.query("packages")
		.paginate({ cursor, numItems });

	let updated = 0;

	await page.page.reduce(async (chain, packageRecord) => {
		await chain;

		if (packageRecord.archived !== undefined) {
			return;
		}

		await ctx.db.patch(packageRecord._id, { archived: packageRecord.hiddenAt !== undefined });
		updated += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		updated
	};
}
