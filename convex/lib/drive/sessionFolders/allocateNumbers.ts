import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { linkBookingDriveClientFromRow } from "#convex/lib/drive/driveBookingDriveClient";
import {
	computeClientSessionFolderNumber,
	computePackageSessionFolderNumber
} from "#convex/lib/drive/sessionFolders/resolveFolderNames";
import { okOrThrow } from "#convex/lib/result";

export type ClientSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_IS_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export type StandaloneBooking = { booking: Doc<"bookings">; driveClientId: Id<"driveClients"> };

export type ClientSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			driveClientId: Id<"driveClients">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

export function clientSessionNumberFromExistingSession(
	ctx: MutationCtx,
	existingSession: Doc<"driveSessions"> | null,
	standaloneBooking: StandaloneBooking
): ResultAsync<ClientSessionNumberAllocation, ClientSessionNumberError> {
	if (existingSession?.clientSessionNumber !== undefined) {
		return okAsync({ kind: "already_saved" as const, number: existingSession.clientSessionNumber });
	}

	return loadNextClientSessionNumber(ctx, standaloneBooking).map((number) => ({
		kind: "new" as const,
		booking: standaloneBooking.booking,
		driveClientId: standaloneBooking.driveClientId,
		existingSession,
		number
	}));
}

function loadNextClientSessionNumber(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
): ResultAsync<number, ClientSessionNumberError> {
	return ResultAsync.fromSafePromise(
		computeClientSessionFolderNumber(
			ctx,
			standaloneBooking.booking,
			standaloneBooking.driveClientId
		)
	).andThen((number) =>
		number === undefined ? errAsync({ reason: "BOOKING_NOT_FOUND" as const }) : okAsync(number)
	);
}

export function saveClientSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<ClientSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, ClientSessionNumberError> {
	const persistNumber =
		allocation.existingSession !== null
			? okOrThrow(
					ctx.db
						.patch("driveSessions", allocation.existingSession._id, {
							clientSessionNumber: allocation.number,
							updatedAt: Date.now()
						})
						.then(() => allocation.number)
				)
			: okOrThrow(
					ctx.db
						.insert("driveSessions", {
							bookingId: allocation.booking._id,
							driveClientId: allocation.driveClientId,
							clientSessionNumber: allocation.number,
							createdAt: Date.now(),
							updatedAt: Date.now()
						})
						.then(() => allocation.number)
				);

	return persistNumber.andThen((number) =>
		linkBookingDriveClientFromRow(
			ctx,
			allocation.booking,
			allocation.booking._id,
			allocation.driveClientId
		).map(() => number)
	);
}

export type PackageSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_NOT_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export type PackageBooking = { booking: Doc<"bookings">; packageId: Id<"packages"> };

export type PackageSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

export function packageSessionNumberFromExistingSession(
	ctx: MutationCtx,
	existingSession: Doc<"driveSessions"> | null,
	packageBooking: PackageBooking
): ResultAsync<PackageSessionNumberAllocation, PackageSessionNumberError> {
	if (existingSession?.packageSessionNumber !== undefined) {
		return okAsync({
			kind: "already_saved" as const,
			number: existingSession.packageSessionNumber
		});
	}

	return loadNextPackageSessionNumber(ctx, packageBooking).map((number) => ({
		kind: "new" as const,
		booking: packageBooking.booking,
		existingSession,
		number
	}));
}

function loadNextPackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<number, PackageSessionNumberError> {
	return ResultAsync.fromSafePromise(
		computePackageSessionFolderNumber(ctx, packageBooking.booking, packageBooking.packageId)
	).andThen((number) =>
		number === undefined ? errAsync({ reason: "BOOKING_NOT_FOUND" as const }) : okAsync(number)
	);
}

export function savePackageSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<PackageSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, PackageSessionNumberError> {
	if (allocation.existingSession !== null) {
		return okOrThrow(
			ctx.db
				.patch("driveSessions", allocation.existingSession._id, {
					packageSessionNumber: allocation.number,
					updatedAt: Date.now()
				})
				.then(() => allocation.number)
		);
	}

	if (allocation.booking.driveClientId === undefined) {
		return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return okOrThrow(
		ctx.db
			.insert("driveSessions", {
				bookingId: allocation.booking._id,
				driveClientId: allocation.booking.driveClientId,
				packageSessionNumber: allocation.number,
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.then(() => allocation.number)
	);
}
