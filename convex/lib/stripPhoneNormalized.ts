import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

export const STRIP_PHONE_NORMALIZED_BATCH_SIZE = 25;

export type StripPhoneNormalizedBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	scanned: number;
	stripped: number;
};

function bookingHasPhoneNormalized(booking: Doc<"bookings">) {
	return booking.phoneNormalized !== undefined;
}

function packageHasPhoneNormalized(packageRecord: Doc<"packages">) {
	return packageRecord.phoneNormalized !== undefined;
}

export async function stripBookingsPhoneNormalizedBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = STRIP_PHONE_NORMALIZED_BATCH_SIZE
): Promise<StripPhoneNormalizedBatchResult> {
	const page = await ctx.db.query("bookings").paginate({ cursor, numItems });

	let stripped = 0;

	await page.page.reduce(async (chain, booking) => {
		await chain;

		if (!bookingHasPhoneNormalized(booking)) {
			return;
		}

		await ctx.db.patch(booking._id, { phoneNormalized: undefined });
		stripped += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		stripped
	};
}

export async function stripPackagesPhoneNormalizedBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = STRIP_PHONE_NORMALIZED_BATCH_SIZE
): Promise<StripPhoneNormalizedBatchResult> {
	const page = await ctx.db.query("packages").paginate({ cursor, numItems });

	let stripped = 0;

	await page.page.reduce(async (chain, packageRecord) => {
		await chain;

		if (!packageHasPhoneNormalized(packageRecord)) {
			return;
		}

		await ctx.db.patch(packageRecord._id, { phoneNormalized: undefined });
		stripped += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		scanned: page.page.length,
		stripped
	};
}
