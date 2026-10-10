import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export function loadDriveSessionForPackageBooking(ctx: QueryCtx, packageBooking: Doc<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
			.unique()
	);
}

export function packageFolderFromOtherPackageBookings(
	ctx: QueryCtx,
	packageBookings: Doc<"bookings">[],
	currentBookingId: Id<"bookings">
): ResultAsync<Doc<"driveSessions">["packageFolder"] | undefined, never> {
	const otherBookings = packageBookings.filter(
		(packageBooking) => packageBooking._id !== currentBookingId
	);

	return ResultAsync.combine(
		otherBookings.map((packageBooking) =>
			loadDriveSessionForPackageBooking(ctx, packageBooking).map(
				(driveSession) => driveSession?.packageFolder
			)
		)
	).map((sharedFolders) => sharedFolders.find((packageFolder) => packageFolder !== undefined));
}

export function loadDriveSetupPackageRecord(ctx: QueryCtx, packageId: Id<"packages"> | undefined) {
	return packageId === undefined
		? okAsync<Doc<"packages"> | null>(null)
		: okOrThrow(ctx.db.get("packages", packageId));
}
