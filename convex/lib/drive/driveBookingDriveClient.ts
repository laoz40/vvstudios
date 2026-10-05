import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export type SyncBookingDriveClientIdFromSessionError = {
	reason: "BOOKING_NOT_FOUND" | "DRIVE_RECORD_NOT_FOUND";
};

export function loadBookingRowForDriveClientSync(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
}

export function loadDriveSessionRowByBookingId(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	);
}

export function patchBookingDriveClientId(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, { driveClientId }).then(() => null));
}

export function ensureBookingDriveClientId(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return loadBookingRowForDriveClientSync(ctx, bookingId).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

		if (booking.driveClientId === driveClientId) return ok(null);

		return patchBookingDriveClientId(ctx, bookingId, driveClientId);
	});
}
