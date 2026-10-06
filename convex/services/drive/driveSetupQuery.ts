import { ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	loadBookingRow,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	loadPackageBookings,
	resolveDriveClientForBooking,
	type DriveSetupInfo
} from "#convex/lib/drive/driveLookup";
import {
	loadDriveSetupPackageRecord,
	packageFolderFromOtherPackageBookings
} from "#convex/lib/drive/driveSetupLoad";

function loadSharedPackageFolderFromBookings(
	ctx: QueryCtx,
	currentBookingId: Id<"bookings">,
	packageBookings: Doc<"bookings">[]
) {
	return packageFolderFromOtherPackageBookings(ctx, packageBookings, currentBookingId);
}

function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"packages">,
	currentBookingId: Id<"bookings">
) {
	return loadPackageBookings(ctx, packageId).andThen((packageBookings: Doc<"bookings">[]) =>
		loadSharedPackageFolderFromBookings(ctx, currentBookingId, packageBookings)
	);
}

function driveSetupWithoutSharedPackageFolder(
	booking: Doc<"bookings">,
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null,
	packageRecord: Doc<"packages"> | null
) {
	return ok({
		booking,
		driveClient,
		driveSession,
		packageRecord,
		sharedPackageFolder: undefined
	} satisfies DriveSetupInfo);
}

function mapSharedPackageFolderToDriveSetup(
	booking: Doc<"bookings">,
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null,
	packageRecord: Doc<"packages"> | null,

	sharedPackageFolder: DriveSetupInfo["sharedPackageFolder"]
) {
	return {
		booking,
		driveClient,
		driveSession,
		packageRecord,
		sharedPackageFolder
	} satisfies DriveSetupInfo;
}

function resolveDriveSetupInfoForBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null,
	packageRecord: Doc<"packages"> | null,

	driveClient: Doc<"driveClients"> | null
) {
	if (driveSession?.packageFolder !== undefined || booking.packageId === undefined) {
		return driveSetupWithoutSharedPackageFolder(booking, driveClient, driveSession, packageRecord);
	}

	return loadSharedPackageFolder(ctx, booking.packageId, booking._id).map(
		(sharedPackageFolder: DriveSetupInfo["sharedPackageFolder"]) =>
			mapSharedPackageFolderToDriveSetup(
				booking,
				driveClient,
				driveSession,
				packageRecord,
				sharedPackageFolder
			)
	);
}

function loadDriveSetupPartsForBooking(
	ctx: QueryCtx,
	bookingId: Id<"bookings">,
	booking: Doc<"bookings"> | null
) {
	if (booking === null) return okAsync(null);

	const driveClientFromBookingResult =
		booking.driveClientId !== undefined
			? loadDriveClientRow(ctx, booking.driveClientId)
			: okAsync<Doc<"driveClients"> | null>(null);

	const driveSessionResult = loadDriveSessionRowByBookingId(ctx, bookingId);
	const packageRecordResult = loadDriveSetupPackageRecord(ctx, booking.packageId);

	return driveClientFromBookingResult
		.andThen((driveClientFromBooking: Doc<"driveClients"> | null) =>
			loadDriveSessionForSetup(driveSessionResult, driveClientFromBooking)
		)
		.andThen((_value) => loadPackageRecordForSetup(ctx, booking, packageRecordResult, _value));
}

function loadDriveSessionForSetup(
	driveSessionResult: ReturnType<typeof loadDriveSessionRowByBookingId>,
	driveClientFromBooking: Doc<"driveClients"> | null
) {
	return driveSessionResult.map((driveSession: Doc<"driveSessions"> | null) => ({
		driveClientFromBooking,
		driveSession
	}));
}

function loadPackageRecordForSetup(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	packageRecordResult: ReturnType<typeof loadDriveSetupPackageRecord>,

	{
		driveClientFromBooking,
		driveSession
	}: {
		driveClientFromBooking: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions"> | null;
	}
) {
	return packageRecordResult.andThen((packageRecord: Doc<"packages"> | null) =>
		resolveDriveSetupAfterPackageRecord(
			ctx,
			booking,
			driveClientFromBooking,
			driveSession,
			packageRecord
		)
	);
}

function resolveDriveSetupAfterPackageRecord(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	driveClientFromBooking: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null,
	packageRecord: Doc<"packages"> | null
) {
	return resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking).andThen(
		(driveClient: Doc<"driveClients"> | null) =>
			resolveDriveSetupInfoForBooking(ctx, booking, driveSession, packageRecord, driveClient)
	);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen((booking: Doc<"bookings"> | null) =>
		loadDriveSetupPartsForBooking(ctx, bookingId, booking)
	);
}
