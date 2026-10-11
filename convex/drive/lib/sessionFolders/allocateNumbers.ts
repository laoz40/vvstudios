import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import { linkBookingDriveClientFromRow } from "#convex/drive/lib/driveBookingDriveClient";

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

export function requireSessionFolderNumber(number: number | undefined) {
	return number === undefined
		? errAsync({ reason: "BOOKING_NOT_FOUND" as const })
		: okAsync(number);
}

export function clientSessionNumberAllocation(
	standaloneBooking: StandaloneBooking,
	existingSession: Doc<"driveSessions"> | null,
	number: number
): ClientSessionNumberAllocation {
	return existingSession?.clientSessionNumber !== undefined
		? { kind: "already_saved", number: existingSession.clientSessionNumber }
		: {
				kind: "new",
				booking: standaloneBooking.booking,
				driveClientId: standaloneBooking.driveClientId,
				existingSession,
				number
			};
}

export function packageSessionNumberAllocation(
	packageBooking: PackageBooking,
	existingSession: Doc<"driveSessions"> | null,
	number: number
): PackageSessionNumberAllocation {
	return existingSession?.packageSessionNumber === undefined
		? { kind: "new", booking: packageBooking.booking, existingSession, number }
		: { kind: "already_saved", number: existingSession.packageSessionNumber };
}

export function saveClientSessionNumber(
	ctx: MutationCtx,
	allocation: ClientSessionNumberAllocation
): ResultAsync<number, ClientSessionNumberError> {
	if (allocation.kind === "already_saved") return okAsync(allocation.number);

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

	return persistNumber;
}

export function linkBookingDriveClientForNewClientSession(
	ctx: MutationCtx,
	allocation: ClientSessionNumberAllocation
): ResultAsync<null, ClientSessionNumberError> {
	if (allocation.kind === "already_saved") return okAsync(null);

	return linkBookingDriveClientFromRow(
		ctx,
		allocation.booking,
		allocation.booking._id,
		allocation.driveClientId
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

export function savePackageSessionNumber(
	ctx: MutationCtx,
	allocation: PackageSessionNumberAllocation
): ResultAsync<number, PackageSessionNumberError> {
	if (allocation.kind === "already_saved") return okAsync(allocation.number);

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
