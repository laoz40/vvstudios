import { err } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { bookingRequiresClientAssetsEmail } from "#convex/booking/lib/bookingAddonQuantities";
import {
	claimClientAssetsEmailRecord,
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
			saveClientDrivePermissionForLoadedSession(ctx, args, driveSession)
	);
}

function saveClientDrivePermissionForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermission>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	return loadDriveClientRow(ctx, driveSession.driveClientId).andThen(
		(driveClient: Doc<"driveClients"> | null) =>
			writeClientDrivePermissionForLoadedClient(ctx, args, driveClient)
	);
}

function writeClientDrivePermissionForLoadedClient(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermission>[1],
	driveClient: Doc<"driveClients"> | null
) {
	if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	return writeClientDrivePermission(ctx, driveClient, args);
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
	if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	return writeClientDrivePermissionsStatusForSession(ctx, driveSession, args.status);
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return loadBookingRow(ctx, args.bookingId).andThen((booking: Doc<"bookings"> | null) =>
		claimClientAssetsEmailForBooking(ctx, args, booking)
	);
}

function claimClientAssetsEmailForBooking(
	ctx: MutationCtx,
	args: Parameters<typeof claimClientAssetsEmail>[1],
	booking: Doc<"bookings"> | null
) {
	if (
		booking === null ||
		booking.driveClientId === undefined ||
		!bookingRequiresClientAssetsEmail(booking.addons)
	) {
		return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
	}

	return loadClientAssetsEmailRows(ctx, {
		bookingId: args.bookingId,
		driveClientId: booking.driveClientId
	}).andThen((_value) => claimClientAssetsEmailFromLoadedRows(ctx, args, booking, _value));
}

function claimClientAssetsEmailFromLoadedRows(
	ctx: MutationCtx,
	args: Parameters<typeof claimClientAssetsEmail>[1],
	booking: Doc<"bookings">,

	[driveClient, driveSession]: [Doc<"driveClients"> | null, Doc<"driveSessions"> | null]
) {
	const assetsFolder = driveClient?.assetsFolder;

	if (driveSession === null || assetsFolder === undefined) {
		return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
	}

	return claimClientAssetsEmailRecord(ctx, {
		attempt: args.attempt,
		assetsFolder,
		booking,
		driveClient: driveClient ?? null,
		driveSession,
		now: args.now
	});
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
			saveClientAssetsEmailResultForLoadedSession(ctx, args, driveSession)
	);
}

function saveClientAssetsEmailResultForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientAssetsEmailResult>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return saveClientAssetsEmailResultForSession(ctx, driveSession, args);
}
