import { err, ok, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export type SyncBookingDriveClientIdFromSessionError = {
	reason: "BOOKING_NOT_FOUND" | "DRIVE_RECORD_NOT_FOUND";
};

export function ensureBookingDriveClientId(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
): ResultAsync<null, SyncBookingDriveClientIdFromSessionError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

		if (booking.driveClientId === driveClientId) return ok(null);

		return okOrThrow(ctx.db.patch(booking._id, { driveClientId }).then(() => null));
	});
}

export function syncBookingDriveClientIdFromSession(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, SyncBookingDriveClientIdFromSessionError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

		return okOrThrow(
			ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
				.unique()
		).andThen((driveSession) => {
			if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

			return ensureBookingDriveClientId(ctx, bookingId, driveSession.driveClientId);
		});
	});
}
