import { okAsync, ResultAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { loadPackageBookings } from "#convex/lib/drive/driveLookup";
import {
	formatDriveNumberedSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

type DriveFolderNumberCtx = Pick<QueryCtx, "db">;

function loadSavedPackageSessionNumbers(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages">
): ResultAsyncType<Set<number>, never> {
	return loadPackageBookings(ctx, packageId).andThen((packageBookings) => {
		if (packageBookings.length === 0) {
			return okAsync(new Set<number>());
		}

		return ResultAsync.combine(
			packageBookings.map((packageBooking) =>
				okOrThrow(
					ctx.db
						.query("driveSessions")
						.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
						.unique()
				).map((driveSession) => driveSession?.packageSessionNumber)
			)
		).map((savedSessionNumbers) => {
			const savedNumbers = new Set<number>();

			for (const sessionNumber of savedSessionNumbers) {
				if (sessionNumber !== undefined) {
					savedNumbers.add(sessionNumber);
				}
			}

			return savedNumbers;
		});
	});
}

function loadPackageSessionsSortedByDate(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages">
): ResultAsyncType<Doc<"bookings">[], never> {
	return loadPackageBookings(ctx, packageId).map((packageBookings) =>
		packageBookings
			.filter((packageBooking) => packageBooking.status !== "cancelled")
			.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt)
	);
}

function computePackageSessionFolderNumberChain(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	packageId: Id<"packages">
): ResultAsyncType<number | undefined, never> {
	return loadPackageSessionsSortedByDate(ctx, packageId).andThen((scheduledSessions) => {
		const sessionIndex = scheduledSessions.findIndex((item) => item._id === booking._id);

		if (sessionIndex === -1) {
			return okAsync(undefined);
		}

		return loadSavedPackageSessionNumbers(ctx, packageId).map((savedNumbers) => {
			let number = sessionIndex + 1;

			while (savedNumbers.has(number)) number += 1;

			return number;
		});
	});
}

export function computePackageSessionFolderNumberResult(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	packageId: Id<"packages">
): ResultAsyncType<number | undefined, never> {
	return computePackageSessionFolderNumberChain(ctx, booking, packageId);
}

export async function computePackageSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	packageId: Id<"packages">
) {
	return computePackageSessionFolderNumberResult(ctx, booking, packageId).match(
		(number) => number,
		() => {
			throw new Error("computePackageSessionFolderNumber failed");
		}
	);
}

function resolveBookingDriveClientId(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">
): ResultAsyncType<Id<"driveClients"> | undefined, never> {
	if (booking.driveClientId !== undefined) {
		return okAsync(booking.driveClientId);
	}

	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) =>
				query.eq("normalizedEmail", booking.email.trim().toLowerCase())
			)
			.unique()
	).map((driveClient) => driveClient?._id);
}

function loadClientStandaloneBookings(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
): ResultAsyncType<Doc<"bookings">[], never> {
	return okOrThrow(ctx.db.get("driveClients", driveClientId)).andThen((driveClient) => {
		if (driveClient === null) {
			return okAsync([]);
		}

		return okOrThrow(
			ctx.db
				.query("bookings")
				.withIndex("by_driveClientId", (query) => query.eq("driveClientId", driveClientId))
				.collect()
		).andThen((bookingsByDriveClientId) =>
			okOrThrow(
				ctx.db
					.query("bookings")
					.withIndex("by_email", (query) => query.eq("email", driveClient.normalizedEmail))
					.collect()
			).map((bookingsByEmail) => {
				const standaloneBookings = new Map<Id<"bookings">, Doc<"bookings">>();

				for (const booking of bookingsByDriveClientId) {
					if (booking.packageId === undefined) standaloneBookings.set(booking._id, booking);
				}

				for (const booking of bookingsByEmail) {
					if (booking.packageId === undefined) standaloneBookings.set(booking._id, booking);
				}

				return [...standaloneBookings.values()];
			})
		);
	});
}

function loadClientStandaloneSessionsSortedByDate(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
): ResultAsyncType<Doc<"bookings">[], never> {
	return loadClientStandaloneBookings(ctx, driveClientId).map((clientBookings) =>
		clientBookings
			.filter((booking) => booking.status !== "cancelled")
			.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt)
	);
}

function loadSavedClientSessionNumbers(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
): ResultAsyncType<Set<number>, never> {
	return loadClientStandaloneBookings(ctx, driveClientId).andThen((clientBookings) => {
		if (clientBookings.length === 0) {
			return okAsync(new Set<number>());
		}

		return ResultAsync.combine(
			clientBookings.map((clientBooking) =>
				okOrThrow(
					ctx.db
						.query("driveSessions")
						.withIndex("by_bookingId", (query) => query.eq("bookingId", clientBooking._id))
						.unique()
				).map((driveSession) => driveSession?.clientSessionNumber)
			)
		).map((savedSessionNumbers) => {
			const savedNumbers = new Set<number>();

			for (const sessionNumber of savedSessionNumbers) {
				if (sessionNumber !== undefined) {
					savedNumbers.add(sessionNumber);
				}
			}

			return savedNumbers;
		});
	});
}

function computeClientSessionFolderNumberChain(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveClientId: Id<"driveClients">
): ResultAsyncType<number | undefined, never> {
	return loadClientStandaloneSessionsSortedByDate(ctx, driveClientId).andThen(
		(scheduledSessions) => {
			const sessionIndex = scheduledSessions.findIndex((item) => item._id === booking._id);

			if (sessionIndex === -1) {
				return okAsync(undefined);
			}

			return loadSavedClientSessionNumbers(ctx, driveClientId).map((savedNumbers) => {
				let number = sessionIndex + 1;

				while (savedNumbers.has(number)) number += 1;

				return number;
			});
		}
	);
}

export function computeClientSessionFolderNumberResult(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveClientId: Id<"driveClients">
): ResultAsyncType<number | undefined, never> {
	return computeClientSessionFolderNumberChain(ctx, booking, driveClientId);
}

export async function computeClientSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return computeClientSessionFolderNumberResult(ctx, booking, driveClientId).match(
		(number) => number,
		() => {
			throw new Error("computeClientSessionFolderNumber failed");
		}
	);
}

function resolveSessionFolderNumberResult(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
): ResultAsyncType<number | undefined, never> {
	if (booking.packageId !== undefined) {
		if (driveSession?.packageSessionNumber !== undefined) {
			return okAsync(driveSession.packageSessionNumber);
		}

		return computePackageSessionFolderNumberResult(ctx, booking, booking.packageId);
	}

	if (driveSession?.clientSessionNumber !== undefined) {
		return okAsync(driveSession.clientSessionNumber);
	}

	return resolveBookingDriveClientId(ctx, booking).andThen((driveClientId) => {
		if (driveClientId === undefined) {
			return okAsync(undefined);
		}

		return computeClientSessionFolderNumberResult(ctx, booking, driveClientId);
	});
}

export async function resolveSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	return resolveSessionFolderNumberResult(ctx, booking, driveSession).match(
		(number) => number,
		() => {
			throw new Error("resolveSessionFolderNumber failed");
		}
	);
}

function resolveSessionFolderDisplayNameResult(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
): ResultAsyncType<string, never> {
	return resolveSessionFolderNumberResult(ctx, booking, driveSession).map((sessionFolderNumber) =>
		sessionFolderNumber === undefined
			? formatDriveSessionFolderName(booking.sessionStartAt)
			: formatDriveNumberedSessionFolderName(sessionFolderNumber, booking.sessionStartAt)
	);
}

export async function resolveSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	return resolveSessionFolderDisplayNameResult(ctx, booking, driveSession).match(
		(name) => name,
		() => {
			throw new Error("resolveSessionFolderDisplayName failed");
		}
	);
}

export function loadSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	return resolveSessionFolderDisplayNameResult(ctx, booking, driveSession);
}
