import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { loadPackageBookings } from "#convex/drive/lib/driveLookup";

export function loadDriveSetupPackageRecord(
	ctx: QueryCtx,
	packageId: Id<"packages"> | null | undefined
) {
	return packageId === null || packageId === undefined
		? okAsync<Doc<"packages"> | null>(null)
		: okOrThrow(ctx.db.get("packages", packageId));
}

export function loadDriveClientForSetupBooking(ctx: QueryCtx, booking: Doc<"bookings"> | null) {
	return booking?.driveClientId === undefined
		? okAsync<Doc<"driveClients"> | null>(null)
		: loadDriveClientRow(ctx, booking.driveClientId);
}

export function loadSharedFolderPackageBookings(
	ctx: QueryCtx,
	booking: Doc<"bookings"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	if (
		booking === null ||
		driveSession?.packageFolder !== undefined ||
		booking.packageId === undefined
	)
		return okAsync<Doc<"bookings">[]>([]);

	return loadPackageBookings(ctx, booking.packageId);
}

export function packageFolderFromOtherPackageBookings(
	ctx: QueryCtx,
	packageBookings: Doc<"bookings">[],
	currentBookingId: Id<"bookings"> | null
) {
	return ResultAsync.combine(
		packageBookings.flatMap((booking) =>
			currentBookingId === null || booking._id === currentBookingId
				? []
				: [
						loadDriveSessionRowByBookingId(ctx, booking._id).map(
							(session) => session?.packageFolder
						)
					]
		)
	).map((folders) => folders.find((folder) => folder !== undefined));
}
