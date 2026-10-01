import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { ensureBookingDriveClientId } from "#convex/lib/driveBookingDriveClient";
import { loadPackageBookings } from "#convex/lib/driveLookup";
import { okOrThrow } from "#convex/lib/result";
import {
	formatDriveNumberedSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

type DriveFolderNumberCtx = Pick<QueryCtx, "db">;

// Numbers of sessions with a saved number stay reserved even when cancelled, because their
// folders already exist in Drive.
async function loadSavedPackageSessionNumbers(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages">
) {
	const savedNumbers = new Set<number>();
	const packageBookings = await loadPackageBookings(ctx, packageId);
	await Promise.all(
		packageBookings.map(async (packageBooking) => {
			const driveSession = await ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
				.unique();

			if (driveSession?.packageSessionNumber !== undefined) {
				savedNumbers.add(driveSession.packageSessionNumber);
			}
		})
	);

	return savedNumbers;
}

async function loadPackageSessionsSortedByDate(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages">
) {
	return (await loadPackageBookings(ctx, packageId))
		.filter((packageBooking) => packageBooking.status !== "cancelled")
		.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}

export async function computePackageSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	packageId: Id<"packages">
) {
	const scheduledSessions = await loadPackageSessionsSortedByDate(ctx, packageId);
	const sessionIndex = scheduledSessions.findIndex((item) => item._id === booking._id);

	if (sessionIndex === -1) return undefined;

	const savedNumbers = await loadSavedPackageSessionNumbers(ctx, packageId);
	let number = sessionIndex + 1;

	while (savedNumbers.has(number)) number += 1;

	return number;
}

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

export async function resolveSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	if (booking.packageId !== undefined) {
		if (driveSession?.packageSessionNumber !== undefined) {
			return driveSession.packageSessionNumber;
		}

		return computePackageSessionFolderNumber(ctx, booking, booking.packageId);
	}

	if (driveSession?.clientSessionNumber !== undefined) {
		return driveSession.clientSessionNumber;
	}

	const driveClientId = await resolveBookingDriveClientId(ctx, booking);

	if (driveClientId === undefined) return undefined;

	return computeClientSessionFolderNumber(ctx, booking, driveClientId);
}

export async function resolveSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	const sessionFolderNumber = await resolveSessionFolderNumber(ctx, booking, driveSession);

	if (sessionFolderNumber === undefined) {
		return formatDriveSessionFolderName(booking.sessionStartAt);
	}

	return formatDriveNumberedSessionFolderName(sessionFolderNumber, booking.sessionStartAt);
}

async function resolveBookingDriveClientId(ctx: DriveFolderNumberCtx, booking: Doc<"bookings">) {
	if (booking.driveClientId !== undefined) return booking.driveClientId;

	const driveClient = await ctx.db
		.query("driveClients")
		.withIndex("by_normalizedEmail", (query) =>
			query.eq("normalizedEmail", booking.email.trim().toLowerCase())
		)
		.unique();

	return driveClient?._id;
}

async function computeClientSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveClientId: Id<"driveClients">
) {
	const scheduledSessions = await loadClientStandaloneSessionsSortedByDate(ctx, driveClientId);
	const sessionIndex = scheduledSessions.findIndex((item) => item._id === booking._id);

	if (sessionIndex === -1) return undefined;

	const savedNumbers = await loadSavedClientSessionNumbers(ctx, driveClientId);
	let number = sessionIndex + 1;

	while (savedNumbers.has(number)) number += 1;

	return number;
}

async function loadSavedClientSessionNumbers(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
) {
	const savedNumbers = new Set<number>();
	const clientBookings = await loadClientStandaloneBookings(ctx, driveClientId);

	await Promise.all(
		clientBookings.map(async (clientBooking) => {
			const driveSession = await ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", clientBooking._id))
				.unique();

			if (driveSession?.clientSessionNumber !== undefined) {
				savedNumbers.add(driveSession.clientSessionNumber);
			}
		})
	);

	return savedNumbers;
}

async function loadClientStandaloneBookings(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
) {
	const driveClient = await ctx.db.get(driveClientId);

	if (driveClient === null) return [];

	const standaloneBookings = new Map<Id<"bookings">, Doc<"bookings">>();

	for (const booking of await ctx.db
		.query("bookings")
		.withIndex("by_driveClientId", (query) => query.eq("driveClientId", driveClientId))
		.collect()) {
		if (booking.packageId === undefined) standaloneBookings.set(booking._id, booking);
	}

	for (const booking of await ctx.db
		.query("bookings")
		.withIndex("by_email", (query) => query.eq("email", driveClient.normalizedEmail))
		.collect()) {
		if (booking.packageId === undefined) standaloneBookings.set(booking._id, booking);
	}

	return [...standaloneBookings.values()];
}

async function loadClientStandaloneSessionsSortedByDate(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients">
) {
	return (await loadClientStandaloneBookings(ctx, driveClientId))
		.filter((booking) => booking.status !== "cancelled")
		.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}
