import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	claimClientAssetsEmailFromRows,
	requireClientAssetsEmailBooking,
	requireDriveClient,
	requireDriveSession,
	saveClientAssetsEmailResultForSession,
	writeClientDrivePermission,
	writeClientDrivePermissionsStatusForSession
} from "#convex/drive/lib/driveClientAccess";
import {
	loadBookingRow,
	loadClientAssetsEmailRows,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: Parameters<typeof writeClientDrivePermission>[2]["permission"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			writeClientDrivePermissionForSession(ctx, args, driveSession)
	);
}

function writeClientDrivePermissionForSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermission>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return requireDriveSession(driveSession)
		.andThen((session) => loadDriveClientRow(ctx, session.driveClientId))
		.andThen((driveClient) => requireDriveClient(driveClient))
		.andThen((client) => writeClientDrivePermission(ctx, client, args));
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: "failed" | "ready" | "skipped" }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			saveClientDrivePermissionsStatusForLoadedSession(ctx, args, driveSession)
	);
}

function saveClientDrivePermissionsStatusForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermissionsStatus>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return requireDriveSession(driveSession).andThen((session) =>
		writeClientDrivePermissionsStatusForSession(ctx, session, args.status)
	);
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return loadBookingRow(ctx, args.bookingId).andThen((booking: Doc<"bookings"> | null) =>
		claimClientAssetsEmailForLoadedBooking(ctx, args, booking)
	);
}

function claimClientAssetsEmailForLoadedBooking(
	ctx: MutationCtx,
	args: Parameters<typeof claimClientAssetsEmail>[1],
	booking: Doc<"bookings"> | null
) {
	return requireClientAssetsEmailBooking(booking)
		.andThen((validBooking) =>
			loadClientAssetsEmailRows(ctx, {
				bookingId: args.bookingId,
				driveClientId: validBooking.driveClientId
			}).map((rows) => ({ booking: validBooking.booking, rows }))
		)
		.andThen(({ booking: validBookingRow, rows }) =>
			claimClientAssetsEmailFromRows(ctx, args, validBookingRow, rows)
		);
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: {
		assetsFolderId: string;
		bookingId: Id<"bookings">;
		claimedAt: number;
		status: "sent" | "failed";
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			saveClientAssetsEmailResultForSession(ctx, driveSession, args)
	);
}
