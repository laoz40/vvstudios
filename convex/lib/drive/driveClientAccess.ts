import { err, ok } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/drive/driveLookup";
import { okOrThrow } from "#convex/lib/result";
import type { SavedDrivePermission } from "#convex/lib/drive/googleDrive";

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

export function writeClientDrivePermissionForClient(
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

export function claimClientAssetsEmailForSendable(
	ctx: MutationCtx,
	args: {
		attempt: "automatic" | "retry";
		assetsFolder: { id: string; url: string };
		booking: Doc<"bookings">;
		driveClient: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions">;
		now: number;
	}
) {
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
		return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
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

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: {
		assetsFolderId: string;
		bookingId: Id<"bookings">;
		claimedAt: number;
		status: "sent" | "failed";
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null || driveSession.assetsEmailClaimedAt !== args.claimedAt) {
			return ok(null);
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
	});
}
