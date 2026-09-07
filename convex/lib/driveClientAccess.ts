import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/driveLookup";
import { okOrThrow } from "#convex/lib/result";
import type { SavedDrivePermission } from "#convex/lib/googleDrive";

type ClientDrivePermissionsStatus = "failed" | "ready" | "skipped";

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: SavedDrivePermission;
	}
) {
	return okOrThrow(ctx.db.get(args.bookingId)).andThen((booking) => {
		if (booking === null || booking.driveClientId === undefined) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}
		return okOrThrow(ctx.db.get(booking.driveClientId)).andThen((driveClient) => {
			if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
			switch (args.name) {
				case "Client folder":
					return okOrThrow(
						ctx.db
							.patch(driveClient._id, { clientFolderPermission: args.permission })
							.then(() => null)
					);
				case "Assets":
					return okOrThrow(
						ctx.db
							.patch(driveClient._id, { assetsClientPermission: args.permission })
							.then(() => null)
					);
				default: {
					const _exhaustive: never = args.name;
					return _exhaustive;
				}
			}
		});
	});
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: ClientDrivePermissionsStatus }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, {
					clientDrivePermissionsStatus: args.status,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
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
		default: {
			const _exhaustive: never = attempt;
			return _exhaustive;
		}
	}
}

function canClaimClientAssetsEmailSend(args: {
	attempt: "automatic" | "retry";
	assetsFolder: { id: string; url: string } | undefined;
	driveSession: Doc<"driveSessions"> | null;
	isEmailCurrent: boolean;
	now: number;
}) {
	if (args.driveSession === null || args.assetsFolder === undefined) {
		return false;
	}

	const { driveSession } = args;
	const permissionsReady =
		driveSession.clientDrivePermissionsStatus === "ready" ||
		driveSession.clientDrivePermissionsStatus === "skipped";
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

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return okOrThrow(ctx.db.get(args.bookingId)).andThen((booking) => {
		if (booking === null || booking.driveClientId === undefined) {
			return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
		}
		return okOrThrow(
			Promise.all([
				ctx.db.get(booking.driveClientId),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
					.unique()
			])
		).andThen(([driveClient, driveSession]) => {
			const assetsFolder = driveClient?.assetsFolder;
			const isEmailCurrent =
				driveSession?.assetsEmailStatus === "sent" &&
				driveSession.assetsEmailFolderId === assetsFolder?.id;
			if (
				!canClaimClientAssetsEmailSend({
					attempt: args.attempt,
					assetsFolder,
					driveSession,
					isEmailCurrent,
					now: args.now
				}) ||
				driveSession === null ||
				assetsFolder === undefined
			) {
				return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
			}

			const claimedDriveSession = driveSession;
			const claimedAssetsFolder = assetsFolder;

			return okOrThrow(
				ctx.db
					.patch(claimedDriveSession._id, { assetsEmailClaimedAt: args.now, updatedAt: Date.now() })
					.then(() => ({
						assetsUrl: claimedAssetsFolder.url,
						assetsFolderId: claimedAssetsFolder.id,
						bookingId: booking._id,
						claimedAt: args.now,
						email: booking.email,
						name: booking.name
					}))
			);
		});
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
				.patch(driveSession._id, {
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
