import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { bookingRequiresClientAssetsEmail } from "#convex/booking/lib/addonQuantities";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/drive/lib/driveLookup";
import { okOrThrow } from "#convex/shared/lib/result";
import type { SavedDrivePermission } from "#convex/drive/lib/googleDrive";

type ClientDrivePermissionsStatus = "failed" | "ready" | "skipped";

export const dismissedClientFolderPermission: SavedDrivePermission = {
	id: "dismissed",
	role: "reader"
};

export function isClientFolderSharingDismissed(
	clientFolderPermission: SavedDrivePermission | undefined
) {
	return clientFolderPermission?.id === dismissedClientFolderPermission.id;
}

export function areClientDrivePermissionsReadyForAssetsEmail(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	if (driveSession === null) return false;

	if (
		driveSession.clientDrivePermissionsStatus === "ready" ||
		driveSession.clientDrivePermissionsStatus === "skipped"
	) {
		return true;
	}

	return driveClient !== null && isClientFolderSharingDismissed(driveClient.clientFolderPermission);
}

export function writeClientDrivePermission(
	ctx: MutationCtx,
	driveClient: Doc<"driveClients">,
	args: { name: "Client folder" | "Assets"; permission: SavedDrivePermission }
) {
	switch (args.name) {
		case "Client folder":
			return okOrThrow(
				ctx.db
					.patch("driveClients", driveClient._id, { clientFolderPermission: args.permission })
					.then(() => null)
			);
		case "Assets":
			return okOrThrow(
				ctx.db
					.patch("driveClients", driveClient._id, { assetsClientPermission: args.permission })
					.then(() => null)
			);
		default:
			return exhaustiveCheck(args.name);
	}
}

export function requireDriveSession(
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<Doc<"driveSessions">, { reason: "DRIVE_RECORD_NOT_FOUND" }> {
	return driveSession === null
		? errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const })
		: okAsync(driveSession);
}

export function requireDriveClient(
	driveClient: Doc<"driveClients"> | null
): ResultAsync<Doc<"driveClients">, { reason: "DRIVE_RECORD_NOT_FOUND" }> {
	return driveClient === null
		? errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const })
		: okAsync(driveClient);
}

export function requireClientAssetsEmailBooking(
	booking: Doc<"bookings"> | null
): ResultAsync<ClientAssetsEmailBooking, { reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" }> {
	return booking === null ||
		booking.driveClientId === undefined ||
		!bookingRequiresClientAssetsEmail(booking.addons)
		? errAsync({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const })
		: okAsync({ booking, driveClientId: booking.driveClientId });
}

export type ClientAssetsEmailBooking = {
	booking: Doc<"bookings">;
	driveClientId: Id<"driveClients">;
};

export function claimClientAssetsEmailFromRows(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number },
	booking: Doc<"bookings">,
	[driveClient, driveSession]: [Doc<"driveClients"> | null, Doc<"driveSessions"> | null]
): ResultAsync<ClientAssetsEmailClaim, { reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" }> {
	const assetsFolder = driveClient?.assetsFolder;

	return driveSession === null || assetsFolder === undefined
		? errAsync({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const })
		: claimClientAssetsEmailRecord(ctx, {
				attempt: args.attempt,
				assetsFolder,
				booking,
				driveClient,
				driveSession,
				now: args.now
			});
}

export function writeClientDrivePermissionsStatusForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions">,
	status: ClientDrivePermissionsStatus
) {
	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				clientDrivePermissionsStatus: status,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}

function canClaimClientAssetsEmail(
	attempt: "automatic" | "retry",
	status: Doc<"driveSessions">["assetsEmailStatus"],
	isEmailCurrent: boolean
) {
	switch (attempt) {
		case "automatic":
			return status === undefined;
		case "retry":
			return status === undefined || status === "failed" || !isEmailCurrent;
		default:
			return exhaustiveCheck(attempt);
	}
}

function canClaimClientAssetsEmailSend(args: {
	attempt: "automatic" | "retry";
	assetsFolder: { id: string; url: string } | undefined;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions"> | null;
	isEmailCurrent: boolean;
	now: number;
}) {
	if (args.driveSession === null || args.assetsFolder === undefined) {
		return false;
	}

	const { driveSession } = args;

	const permissionsReady = areClientDrivePermissionsReadyForAssetsEmail(
		args.driveClient,
		driveSession
	);

	const claimStillActive =
		driveSession.assetsEmailClaimedAt !== undefined &&
		args.now - driveSession.assetsEmailClaimedAt < DRIVE_EMAIL_CLAIM_TIMEOUT_MS;

	return (
		permissionsReady &&
		!args.isEmailCurrent &&
		!claimStillActive &&
		canClaimClientAssetsEmail(args.attempt, driveSession.assetsEmailStatus, args.isEmailCurrent)
	);
}

export type ClientAssetsEmailClaim = {
	assetsUrl: string;
	assetsFolderId: string;
	bookingId: Id<"bookings">;
	claimedAt: number;
	email: string;
	name: string;
};

export function claimClientAssetsEmailRecord(
	ctx: MutationCtx,
	args: {
		attempt: "automatic" | "retry";
		assetsFolder: { id: string; url: string };
		booking: Doc<"bookings">;
		driveClient: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions">;
		now: number;
	}
): ResultAsync<ClientAssetsEmailClaim, { reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" }> {
	const isEmailCurrent =
		args.driveSession.assetsEmailStatus === "sent" &&
		args.driveSession.assetsEmailFolderId === args.assetsFolder.id;

	if (
		!canClaimClientAssetsEmailSend({
			attempt: args.attempt,
			assetsFolder: args.assetsFolder,
			driveClient: args.driveClient,
			driveSession: args.driveSession,
			isEmailCurrent,
			now: args.now
		})
	) {
		return errAsync({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
	}

	return okOrThrow(
		ctx.db
			.patch("driveSessions", args.driveSession._id, {
				assetsEmailClaimedAt: args.now,
				updatedAt: Date.now()
			})
			.then(() => ({
				assetsUrl: args.assetsFolder.url,
				assetsFolderId: args.assetsFolder.id,
				bookingId: args.booking._id,
				claimedAt: args.now,
				email: args.booking.email,
				name: args.booking.name
			}))
	);
}

export function saveClientAssetsEmailResultForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: { assetsFolderId: string; claimedAt: number; status: "sent" | "failed" }
): ResultAsync<null, never> {
	if (driveSession === null || driveSession.assetsEmailClaimedAt !== args.claimedAt) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				assetsEmailClaimedAt: undefined,
				assetsEmailFolderId:
					args.status === "sent" ? args.assetsFolderId : driveSession.assetsEmailFolderId,
				assetsEmailStatus: args.status,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}
