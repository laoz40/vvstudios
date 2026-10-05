import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { externalPromise } from "#convex/lib/result";
import { loadPackageBookings } from "#convex/lib/drive/driveLookup";
import {
	formatDriveNumberedSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

type DriveFolderNumberCtx = Pick<QueryCtx, "db">;

async function loadSavedPackageSessionNumbers(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages">
) {
	const savedNumbers = new Set<number>();

	const packageBookings = await loadPackageBookings(ctx, packageId).match(
		(bookings) => bookings,
		() => {
			throw new Error("loadPackageBookings failed");
		}
	);

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
	const packageBookings = await loadPackageBookings(ctx, packageId).match(
		(bookings) => bookings,
		() => {
			throw new Error("loadPackageBookings failed");
		}
	);

	return packageBookings
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

export function loadSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	return externalPromise(resolveSessionFolderDisplayName(ctx, booking, driveSession));
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

export async function computeClientSessionFolderNumber(
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
	const driveClient = await ctx.db.get("driveClients", driveClientId);

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
