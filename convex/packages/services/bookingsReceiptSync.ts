import { ResultAsync, ok, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";
import {
	loadPackageBookingsForReceiptSync,
	patchPackageBookingReceiptNumber
} from "#convex/packages/lib/bookingsReceiptSync";

function loadBookingReceiptSearchPatches(
	ctx: MutationCtx,
	bookings: Doc<"bookings">[],
	receiptNumber: string
) {
	return ResultAsync.combine(
		bookings.map((booking) =>
			safeTry(async function* () {
				const searchPatch = yield* searchBlobPatchForBookingAsync(ctx, booking, { receiptNumber });

				return ok({ bookingId: booking._id, searchPatch });
			})
		)
	);
}

function writeBookingReceiptNumbers(
	ctx: MutationCtx,
	receiptNumber: string,
	patches: { bookingId: Id<"bookings">; searchPatch: BookingSearchBlobPatch }[]
) {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			patches.map(({ bookingId, searchPatch }) =>
				patchPackageBookingReceiptNumber(ctx, bookingId, receiptNumber, searchPatch)
			)
		);

		return ok(null);
	});
}

export function syncPackageBookingsReceiptNumber(
	ctx: MutationCtx,
	packageId: Id<"packages"> | null,
	receiptNumber: string
) {
	return safeTry(async function* () {
		const bookings = yield* loadPackageBookingsForReceiptSync(ctx, packageId);
		const searchPatches = yield* loadBookingReceiptSearchPatches(ctx, bookings, receiptNumber);
		yield* writeBookingReceiptNumbers(ctx, receiptNumber, searchPatches);

		return ok(null);
	});
}
