import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";

export function patchPackageBookingsReceiptNumber(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	receiptNumber: string
) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_packageId_and_status_and_sessionStartAt", (indexQuery) =>
				indexQuery.eq("packageId", packageId)
			)
			.collect()
			.then(async (bookings) => {
				await Promise.all(
					bookings.map(async (booking) =>
						ctx.db.patch("bookings", booking._id, {
							receiptNumber,
							...(await searchBlobPatchForBooking(ctx, booking, { receiptNumber }))
						})
					)
				);

				return null;
			})
	);
}
