import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { ensureBookingDriveClientId } from "#convex/lib/drive/driveBookingDriveClient";
import {
	computeClientSessionFolderNumber,
	computePackageSessionFolderNumber
} from "#convex/lib/drive/sessionFolders/resolveFolderNames";
import { okOrThrow } from "#convex/lib/result";

type ClientSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_IS_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export function allocateClientSessionNumber(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return getStandaloneBooking(ctx, args.bookingId)
		.andThen((standaloneBooking) => resolveClientSessionNumber(ctx, standaloneBooking))
		.andThen((allocation) => {
			if (allocation.kind === "already_saved") return okAsync(allocation.number);

			return saveClientSessionNumber(ctx, allocation);
		});
}

type StandaloneBooking = { booking: Doc<"bookings">; driveClientId: Id<"driveClients"> };

function getStandaloneBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<StandaloneBooking, ClientSessionNumberError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

		if (booking.packageId !== undefined) {
			return errAsync({ reason: "BOOKING_IS_PACKAGE" as const });
		}

		if (booking.driveClientId !== undefined) {
			return okAsync({ booking, driveClientId: booking.driveClientId });
		}

		return okOrThrow(
			ctx.db
				.query("driveClients")
				.withIndex("by_normalizedEmail", (query) =>
					query.eq("normalizedEmail", booking.email.trim().toLowerCase())
				)
				.unique()
		).andThen((driveClient) => {
			if (driveClient === null) return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

			return okAsync({ booking, driveClientId: driveClient._id });
		});
	});
}

type ClientSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			driveClientId: Id<"driveClients">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

function resolveClientSessionNumber(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
): ResultAsync<ClientSessionNumberAllocation, ClientSessionNumberError> {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", standaloneBooking.booking._id))
			.unique()
	).andThen((existingSession) => {
		if (existingSession?.clientSessionNumber !== undefined) {
			return okAsync({
				kind: "already_saved" as const,
				number: existingSession.clientSessionNumber
			});
		}

		return loadNextClientSessionNumber(ctx, standaloneBooking).map((number) => ({
			kind: "new" as const,
			booking: standaloneBooking.booking,
			driveClientId: standaloneBooking.driveClientId,
			existingSession,
			number
		}));
	});
}

function loadNextClientSessionNumber(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
): ResultAsync<number, ClientSessionNumberError> {
	return okOrThrow(
		computeClientSessionFolderNumber(
			ctx,
			standaloneBooking.booking,
			standaloneBooking.driveClientId
		)
	).andThen((number) =>
		number === undefined ? errAsync({ reason: "BOOKING_NOT_FOUND" as const }) : okAsync(number)
	);
}

function saveClientSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<ClientSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, ClientSessionNumberError> {
	const persistNumber =
		allocation.existingSession !== null
			? okOrThrow(
					ctx.db
						.patch(allocation.existingSession._id, {
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
		ensureBookingDriveClientId(ctx, allocation.booking._id, allocation.driveClientId).map(
			() => number
		)
	);
}

type PackageSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_NOT_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getPackageBooking(ctx, args.bookingId)
		.andThen((packageBooking) => resolvePackageSessionNumber(ctx, packageBooking))
		.andThen((allocation) => {
			if (allocation.kind === "already_saved") return okAsync(allocation.number);

			return savePackageSessionNumber(ctx, allocation);
		});
}

type PackageBooking = { booking: Doc<"bookings">; packageId: Id<"packages"> };

function getPackageBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<PackageBooking, PackageSessionNumberError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

		if (booking.packageId === undefined) {
			return err({ reason: "BOOKING_NOT_PACKAGE" as const });
		}

		return ok({ booking, packageId: booking.packageId });
	});
}

type PackageSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

function resolvePackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<PackageSessionNumberAllocation, PackageSessionNumberError> {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking.booking._id))
			.unique()
	).andThen((existingSession) => {
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
	});
}

function loadNextPackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<number, PackageSessionNumberError> {
	return okOrThrow(
		computePackageSessionFolderNumber(ctx, packageBooking.booking, packageBooking.packageId)
	).andThen((number) =>
		number === undefined ? errAsync({ reason: "BOOKING_NOT_FOUND" as const }) : okAsync(number)
	);
}

function savePackageSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<PackageSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, PackageSessionNumberError> {
	if (allocation.existingSession !== null) {
		return okOrThrow(
			ctx.db
				.patch(allocation.existingSession._id, {
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
