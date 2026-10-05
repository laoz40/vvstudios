import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export type SyncBookingDriveClientIdFromSessionError = {
	reason: "BOOKING_NOT_FOUND" | "DRIVE_RECORD_NOT_FOUND";
};

export function loadBookingRowForDriveClientSync(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
}

export function loadDriveClientRow(ctx: Pick<QueryCtx, "db">, driveClientId: Id<"driveClients">) {
	return okOrThrow(ctx.db.get("driveClients", driveClientId));
}

export function loadBookingRow(ctx: Pick<QueryCtx, "db">, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
}

export function loadClientAssetsEmailRows(
	ctx: Pick<QueryCtx, "db">,
	args: { bookingId: Id<"bookings">; driveClientId: Id<"driveClients"> }
) {
	return okOrThrow(
		Promise.all([
			ctx.db.get("driveClients", args.driveClientId),
			ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
				.unique()
		])
	);
}

export function loadDriveSessionRowByBookingId(
	ctx: Pick<QueryCtx, "db">,
	bookingId: Id<"bookings">
) {
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
