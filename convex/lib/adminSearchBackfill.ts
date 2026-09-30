import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { searchBlobPatchForBooking, searchBlobPatchForPackage } from "#convex/lib/adminSearchBlob";
import { normalizePhone } from "#convex/lib/contactNormalization";

export const ADMIN_SEARCH_BACKFILL_BATCH_SIZE = 25;

export type AdminSearchBackfillBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	patched: number;
	scanned: number;
};

function isPaidBooking(booking: Doc<"bookings">) {
	return booking.status === "confirmed" || booking.status === "email_failed";
}

export function receiptNumberForPaidPackage(packageRecord: Doc<"packages">): string | undefined {
	if (packageRecord.status !== "paid") {
		return undefined;
	}

	if (packageRecord.receiptNumber === undefined || packageRecord.receiptNumber.length === 0) {
		return undefined;
	}

	return packageRecord.receiptNumber;
}

export async function receiptNumberForPaidBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">
): Promise<string | undefined> {
	if (!isPaidBooking(booking)) {
		return undefined;
	}

	if (booking.receiptNumber !== undefined && booking.receiptNumber.length > 0) {
		return booking.receiptNumber;
	}

	if (booking.packageId !== undefined) {
		const packageRecord = await ctx.db.get(booking.packageId);

		if (packageRecord === null || packageRecord.status !== "paid") {
			return undefined;
		}

		return receiptNumberForPaidPackage(packageRecord);
	}

	return undefined;
}

type BookingAdminSearchBackfillPatch = {
	phone: string;
	searchBlob: string;
	receiptNumber?: string;
	assignedEditorDisplayName?: string;
};

type PackageAdminSearchBackfillPatch = {
	phone: string;
	searchBlob: string;
	receiptNumber?: string;
};

export async function adminSearchBackfillPatchForBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">
): Promise<BookingAdminSearchBackfillPatch> {
	const phone = normalizePhone(booking.phone);
	const receiptNumber = await receiptNumberForPaidBooking(ctx, booking);

	const searchBlobOverrides = receiptNumber !== undefined ? { receiptNumber } : {};

	const searchBlobPatch = await searchBlobPatchForBooking(
		ctx,
		{ ...booking, phone },
		searchBlobOverrides
	);

	const patch: BookingAdminSearchBackfillPatch = { phone, searchBlob: searchBlobPatch.searchBlob };

	if (searchBlobPatch.assignedEditorDisplayName !== undefined) {
		patch.assignedEditorDisplayName = searchBlobPatch.assignedEditorDisplayName;
	}

	if (receiptNumber !== undefined) {
		patch.receiptNumber = receiptNumber;
	}

	return patch;
}

export function adminSearchBackfillPatchForPackage(
	packageRecord: Doc<"packages">
): PackageAdminSearchBackfillPatch {
	const phone = normalizePhone(packageRecord.phone);
	const receiptNumber = receiptNumberForPaidPackage(packageRecord);

	const searchBlobOverrides = receiptNumber !== undefined ? { receiptNumber } : {};

	const searchBlobPatch = searchBlobPatchForPackage(
		{ ...packageRecord, phone },
		searchBlobOverrides
	);

	const patch: PackageAdminSearchBackfillPatch = { phone, searchBlob: searchBlobPatch.searchBlob };

	if (receiptNumber !== undefined) {
		patch.receiptNumber = receiptNumber;
	}

	return patch;
}

function bookingAdminSearchBackfillNeedsPatch(
	booking: Doc<"bookings">,
	patch: BookingAdminSearchBackfillPatch
) {
	if (booking.phone !== patch.phone) {
		return true;
	}

	if (booking.searchBlob !== patch.searchBlob) {
		return true;
	}

	if (patch.receiptNumber !== undefined && booking.receiptNumber !== patch.receiptNumber) {
		return true;
	}

	if (
		patch.assignedEditorDisplayName !== undefined &&
		booking.assignedEditorDisplayName !== patch.assignedEditorDisplayName
	) {
		return true;
	}

	return false;
}

function packageAdminSearchBackfillNeedsPatch(
	packageRecord: Doc<"packages">,
	patch: PackageAdminSearchBackfillPatch
) {
	if (packageRecord.phone !== patch.phone) {
		return true;
	}

	if (packageRecord.searchBlob !== patch.searchBlob) {
		return true;
	}

	if (patch.receiptNumber !== undefined && packageRecord.receiptNumber !== patch.receiptNumber) {
		return true;
	}

	return false;
}

export async function backfillBookingsAdminSearchBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = ADMIN_SEARCH_BACKFILL_BATCH_SIZE
): Promise<AdminSearchBackfillBatchResult> {
	const page = await ctx.db.query("bookings").paginate({ cursor, numItems });

	let patched = 0;

	await page.page.reduce(async (chain, booking) => {
		await chain;

		const patch = await adminSearchBackfillPatchForBooking(ctx, booking);

		if (!bookingAdminSearchBackfillNeedsPatch(booking, patch)) {
			return;
		}

		await ctx.db.patch(booking._id, patch);
		patched += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		patched,
		scanned: page.page.length
	};
}

export async function backfillPackagesAdminSearchBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = ADMIN_SEARCH_BACKFILL_BATCH_SIZE
): Promise<AdminSearchBackfillBatchResult> {
	const page = await ctx.db.query("packages").paginate({ cursor, numItems });

	let patched = 0;

	await page.page.reduce(async (chain, packageRecord) => {
		await chain;

		const patch = adminSearchBackfillPatchForPackage(packageRecord);

		if (!packageAdminSearchBackfillNeedsPatch(packageRecord, patch)) {
			return;
		}

		await ctx.db.patch(packageRecord._id, patch);
		patched += 1;
	}, Promise.resolve());

	return {
		continueCursor: page.isDone ? null : page.continueCursor,
		isDone: page.isDone,
		patched,
		scanned: page.page.length
	};
}
