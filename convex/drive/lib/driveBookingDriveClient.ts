import { errAsync, okAsync } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export type LinkBookingDriveClientError = { reason: "BOOKING_NOT_FOUND" };

export type SyncBookingDriveClientIdFromSessionError = {
	reason: "BOOKING_NOT_FOUND" | "DRIVE_RECORD_NOT_FOUND";
};

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

export function loadDriveSessionRow(
	ctx: Pick<QueryCtx, "db">,
	driveSessionId: Id<"driveSessions">
) {
	return okOrThrow(ctx.db.get("driveSessions", driveSessionId));
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

export function linkBookingDriveClientFromRow(
	ctx: MutationCtx,
	booking: Doc<"bookings"> | null,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
): ResultAsync<null, LinkBookingDriveClientError> {
	if (booking === null) {
		return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	}

	if (booking.driveClientId === driveClientId) {
		return okAsync(null);
	}

	return patchBookingDriveClientId(ctx, bookingId, driveClientId);
}

export function syncBookingDriveClientIdFromSessionRows(
	ctx: MutationCtx,
	booking: Doc<"bookings"> | null,
	bookingId: Id<"bookings">,
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<null, SyncBookingDriveClientIdFromSessionError> {
	if (booking === null) {
		return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	}

	if (driveSession === null) {
		return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	if (booking.driveClientId === driveSession.driveClientId) {
		return okAsync(null);
	}

	return patchBookingDriveClientId(ctx, bookingId, driveSession.driveClientId);
}
