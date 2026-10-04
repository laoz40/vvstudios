import { ok, okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export const DRIVE_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export function resolveDriveClientForBooking(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions"> | null,
	driveClientFromBooking: Doc<"driveClients"> | null
): ResultAsync<Doc<"driveClients"> | null, never> {
	if (driveSession?.driveClientId !== undefined) {
		return okOrThrow(ctx.db.get("driveClients", driveSession.driveClientId)).map((sessionClient) =>
			sessionClient !== null ? sessionClient : driveClientFromBooking
		);
	}

	return okAsync(driveClientFromBooking);
}

export async function loadPackageBookings(ctx: Pick<QueryCtx, "db">, packageId: Id<"packages">) {
	return await ctx.db
		.query("bookings")
		.withIndex("by_packageId_and_status_and_sessionStartAt", (query) =>
			query.eq("packageId", packageId)
		)
		.collect();
}

export function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"packages">,
	currentBookingId: Id<"bookings">
): ResultAsync<Doc<"driveSessions">["packageFolder"] | undefined, never> {
	return okOrThrow(loadPackageBookings(ctx, packageId)).andThen((packageBookings) =>
		ResultAsync.combine(
			packageBookings
				.filter((packageBooking) => packageBooking._id !== currentBookingId)
				.map((packageBooking) =>
					okOrThrow(
						ctx.db
							.query("driveSessions")
							.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
							.unique()
					).map((driveSession) => driveSession?.packageFolder)
				)
		).map((sharedFolders) => sharedFolders.find((packageFolder) => packageFolder !== undefined))
	);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId)).andThen((booking) => {
		if (booking === null) return ok(null);

		return okOrThrow(
			Promise.all([
				booking.driveClientId !== undefined
					? ctx.db.get("driveClients", booking.driveClientId)
					: Promise.resolve(null),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique(),
				booking.packageId !== undefined
					? ctx.db.get("packages", booking.packageId)
					: Promise.resolve(null)
			])
		).andThen(([driveClientFromBooking, driveSession, packageRecord]) =>
			resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking).andThen(
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

					return loadSharedPackageFolder(ctx, booking.packageId, booking._id).map(
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
