import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const bookings = yield* loadSharedFolderPackageBookings(ctx, booking, driveSession);

		const folder = yield* packageFolderFromOtherPackageBookings(
			ctx,
			bookings,
			booking?._id ?? null
		);

		return ok(folder);
	});
}

function loadDriveSetupPartsForBooking(ctx: QueryCtx, booking: Doc<"bookings"> | null) {
	return safeTry(async function* () {
		const [driveClientFromBooking, driveSession, packageRecord] = yield* ResultAsync.combine([
			loadDriveClientForSetupBooking(ctx, booking),
			loadDriveSessionRowByBookingId(ctx, booking?._id ?? null),
			loadDriveSetupPackageRecord(ctx, booking?.packageId)
		]);

		const driveClient = yield* resolveDriveClientForBooking(
			ctx,
			driveSession,
			driveClientFromBooking
		);

		const sharedPackageFolder = yield* loadSharedPackageFolder(ctx, booking, driveSession);

		return ok(
			booking === null
				? null
				: { booking, driveClient, driveSession, packageRecord, sharedPackageFolder }
		);
	});
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, bookingId);
		const setup = yield* loadDriveSetupPartsForBooking(ctx, booking);

		return ok(setup);
	});
}
