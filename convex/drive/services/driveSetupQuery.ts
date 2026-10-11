import { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	loadBookingRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { resolveDriveClientForBooking } from "#convex/drive/lib/driveLookup";
import {
	loadDriveClientForSetupBooking,
	loadDriveSetupPackageRecord,
	loadSharedFolderPackageBookings,
	packageFolderFromOtherPackageBookings
} from "#convex/drive/lib/driveSetupLoad";

function loadSharedPackageFolder(
	ctx: QueryCtx,
	booking: Doc<"bookings"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	return loadSharedFolderPackageBookings(ctx, booking, driveSession).andThen((bookings) =>
		packageFolderFromOtherPackageBookings(ctx, bookings, booking?._id ?? null)
	);
}

function loadDriveSetupPartsForBooking(ctx: QueryCtx, booking: Doc<"bookings"> | null) {
	return ResultAsync.combine([
		loadDriveClientForSetupBooking(ctx, booking),
		loadDriveSessionRowByBookingId(ctx, booking?._id ?? null),
		loadDriveSetupPackageRecord(ctx, booking?.packageId)
	]).andThen(([driveClientFromBooking, driveSession, packageRecord]) =>
		resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking).andThen((driveClient) =>
			loadSharedPackageFolder(ctx, booking, driveSession).map((sharedPackageFolder) =>
				booking === null
					? null
					: { booking, driveClient, driveSession, packageRecord, sharedPackageFolder }
			)
		)
	);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen((booking) =>
		loadDriveSetupPartsForBooking(ctx, booking)
	);
}
