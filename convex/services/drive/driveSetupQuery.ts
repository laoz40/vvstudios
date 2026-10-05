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

function loadSharedPackageFolderFromBookings(ctx: QueryCtx, currentBookingId: Id<"bookings">) {
	return (packageBookings: Doc<"bookings">[]) =>
		packageFolderFromOtherPackageBookings(ctx, packageBookings, currentBookingId);
}

function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"packages">,
	currentBookingId: Id<"bookings">
) {
	return loadPackageBookings(ctx, packageId).andThen(
		loadSharedPackageFolderFromBookings(ctx, currentBookingId)
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
	packageRecord: Doc<"packages"> | null
) {
	return (sharedPackageFolder: DriveSetupInfo["sharedPackageFolder"]) =>
		({
			booking,
			driveClient,
			driveSession,
			packageRecord,
			sharedPackageFolder
		}) satisfies DriveSetupInfo;
}

function resolveDriveSetupInfoForBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null,
	packageRecord: Doc<"packages"> | null
) {
	return (driveClient: Doc<"driveClients"> | null) => {
		if (driveSession?.packageFolder !== undefined || booking.packageId === undefined) {
			return driveSetupWithoutSharedPackageFolder(
				booking,
				driveClient,
				driveSession,
				packageRecord
			);
		}

		return loadSharedPackageFolder(ctx, booking.packageId, booking._id).map(
			mapSharedPackageFolderToDriveSetup(booking, driveClient, driveSession, packageRecord)
		);
	};
}

function loadDriveSetupPartsForBooking(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return (booking: Doc<"bookings"> | null) => {
		if (booking === null) return okAsync(null);

		const driveClientFromBookingResult =
			booking.driveClientId !== undefined
				? loadDriveClientRow(ctx, booking.driveClientId)
				: okAsync<Doc<"driveClients"> | null>(null);

		const driveSessionResult = loadDriveSessionRowByBookingId(ctx, bookingId);
		const packageRecordResult = loadDriveSetupPackageRecord(ctx, booking.packageId);

		return driveClientFromBookingResult
			.andThen(loadDriveSessionForSetup(driveSessionResult))
			.andThen(loadPackageRecordForSetup(ctx, booking, packageRecordResult));
	};
}

function loadDriveSessionForSetup(
	driveSessionResult: ReturnType<typeof loadDriveSessionRowByBookingId>
) {
	return (driveClientFromBooking: Doc<"driveClients"> | null) =>
		driveSessionResult.andThen(loadPackageRecordChainStart(driveClientFromBooking));
}

function loadPackageRecordChainStart(driveClientFromBooking: Doc<"driveClients"> | null) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		ok({ driveClientFromBooking, driveSession });
}

function loadPackageRecordForSetup(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	packageRecordResult: ReturnType<typeof loadDriveSetupPackageRecord>
) {
	return ({
		driveClientFromBooking,
		driveSession
	}: {
		driveClientFromBooking: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions"> | null;
	}) =>
		packageRecordResult.andThen(
			resolveDriveSetupAfterPackageRecord(ctx, booking, driveClientFromBooking, driveSession)
		);
}

function resolveDriveSetupAfterPackageRecord(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	driveClientFromBooking: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	return (packageRecord: Doc<"packages"> | null) =>
		resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking).andThen(
			resolveDriveSetupInfoForBooking(ctx, booking, driveSession, packageRecord)
		);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen(loadDriveSetupPartsForBooking(ctx, bookingId));
}
