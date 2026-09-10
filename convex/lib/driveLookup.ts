import { ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export const DRIVE_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export async function resolveDriveClientForBooking(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions"> | null,
	driveClientFromBooking: Doc<"driveClients"> | null
): Promise<Doc<"driveClients"> | null> {
	if (driveSession?.driveClientId !== undefined) {
		const sessionClient = await ctx.db.get(driveSession.driveClientId);

		if (sessionClient !== null) return sessionClient;
	}

	return driveClientFromBooking;
}

export async function loadPackageBookings(ctx: QueryCtx, packageId: Id<"packages">) {
	return await ctx.db
		.query("bookings")
		.withIndex("by_packageId", (query) => query.eq("packageId", packageId))
		.collect();
}

export async function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"packages">,
	currentBookingId: Id<"bookings">
) {
	const packageBookings = await loadPackageBookings(ctx, packageId);

	const sharedFolders = await Promise.all(
		packageBookings
			.filter((packageBooking) => packageBooking._id !== currentBookingId)
			.map(async (packageBooking) => {
				const driveSession = await ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
					.unique();

				return driveSession?.packageFolder;
			})
	);

	return sharedFolders.find((packageFolder) => packageFolder !== undefined);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return ok(null);

		return okOrThrow(
			Promise.all([
				booking.driveClientId !== undefined
					? ctx.db.get(booking.driveClientId)
					: Promise.resolve(null),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique(),
				booking.packageId !== undefined ? ctx.db.get(booking.packageId) : Promise.resolve(null)
			])
		).andThen(([driveClientFromBooking, driveSession, packageRecord]) =>
			okOrThrow(resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking)).andThen(
				(driveClient) => {
					if (driveSession?.packageFolder !== undefined || booking.packageId === undefined) {
						return ok({
							booking,
							driveClient,
							driveSession,
							packageRecord,
							sharedPackageFolder: undefined
						});
					}

					return okOrThrow(loadSharedPackageFolder(ctx, booking.packageId, booking._id)).map(
						(sharedPackageFolder) => ({
							booking,
							driveClient,
							driveSession,
							packageRecord,
							sharedPackageFolder
						})
					);
				}
			)
		);
	});
}
