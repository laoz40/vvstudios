import { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";
import {
	loadPackageBookingsForReceiptSync,
	patchPackageBookingReceiptNumber
} from "#convex/packages/lib/packageBookingsReceiptSync";

function loadBookingReceiptSearchPatches(
	ctx: MutationCtx,
	bookings: Doc<"bookings">[],
	receiptNumber: string
) {
	return ResultAsync.combine(
		bookings.map((booking) =>
			searchBlobPatchForBookingAsync(ctx, booking, { receiptNumber }).map((searchPatch) => ({
				bookingId: booking._id,
				searchPatch
			}))
		)
	);
}

function writeBookingReceiptNumbers(
	ctx: MutationCtx,
	receiptNumber: string,
	patches: { bookingId: Id<"bookings">; searchPatch: BookingSearchBlobPatch }[]
) {
	return ResultAsync.combine(
		patches.map(({ bookingId, searchPatch }) =>
			patchPackageBookingReceiptNumber(ctx, bookingId, receiptNumber, searchPatch)
		)
	).map(() => null);
}

export function syncPackageBookingsReceiptNumber(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	receiptNumber: string
) {
	return loadPackageBookingsForReceiptSync(ctx, packageId)
		.andThen((bookings) => loadBookingReceiptSearchPatches(ctx, bookings, receiptNumber))
		.andThen((patches) => writeBookingReceiptNumbers(ctx, receiptNumber, patches));
}
