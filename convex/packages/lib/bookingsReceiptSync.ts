import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { BookingSearchBlobPatch } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/shared/lib/result";

export function loadPackageBookingsForReceiptSync(ctx: MutationCtx, packageId: Id<"packages">) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_packageId_and_status_and_sessionStartAt", (indexQuery) =>
				indexQuery.eq("packageId", packageId)
			)
			.collect()
	);
}

export function patchPackageBookingReceiptNumber(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	receiptNumber: string,
	searchPatch: BookingSearchBlobPatch
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, { receiptNumber, ...searchPatch })).map(
		() => null
	);
}
