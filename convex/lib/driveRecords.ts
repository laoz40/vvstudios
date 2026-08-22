import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/lib/googleDrive";

export const CLIENT_ASSETS_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type ClientDrivePermissionsStatus = "failed" | "ready";
type ClientDrivePermissionsDisplayStatus = "failed" | "incomplete" | "not_created" | "ready";
type AssetsEmailDisplayStatus = "failed" | "not_sent" | "pending" | "sent";

export function buildDriveStatus(
	driveSession: Doc<"driveSessions"> | null,
	driveSetupFailed: boolean
) {
	if (driveSession === null) {
		return { status: driveSetupFailed ? ("failed" as const) : ("not_created" as const) };
	}

	const folders = [
		{ name: "Session", url: driveSession.sessionFolder?.url },
		{ name: "Raw Media", url: driveSession.rawMediaFolder?.url },
		{ name: "Assets", url: driveSession.assetsFolder?.url },
		{ name: "Deliverables", url: driveSession.deliverablesFolder?.url }
	] satisfies Array<{ name: "Session" | DriveChildFolderName; url: string | undefined }>;

	// Child folders are created in order. Deliverables can only exist after Raw Media access is limited.
	const isReady = folders.every((folder) => folder.url !== undefined);
	return { status: isReady ? ("ready" as const) : ("incomplete" as const), folders };
}

export function buildClientDrivePermissionsStatus(driveSession: Doc<"driveSessions"> | null) {
	return {
		assetsEmailStatus: buildAssetsEmailStatus(driveSession),
		status: buildClientDrivePermissionsDisplayStatus(driveSession)
	};
}

function buildClientDrivePermissionsDisplayStatus(
	driveSession: Doc<"driveSessions"> | null
): ClientDrivePermissionsDisplayStatus {
	if (driveSession === null) {
		return "not_created";
	}

	const foldersAreReady =
		driveSession.sessionFolder !== undefined &&
		driveSession.rawMediaFolder !== undefined &&
		driveSession.assetsFolder !== undefined &&
		driveSession.deliverablesFolder !== undefined;
	switch (driveSession.clientDrivePermissionsStatus) {
		case "failed":
			return "failed";
		case "ready":
			return foldersAreReady ? "ready" : "incomplete";
		case undefined:
			return foldersAreReady ? "incomplete" : "not_created";
		default: {
			const _exhaustive: never = driveSession.clientDrivePermissionsStatus;
			return _exhaustive;
		}
	}
}

function buildAssetsEmailStatus(
	driveSession: Doc<"driveSessions"> | null
): AssetsEmailDisplayStatus {
	if (driveSession === null) return "not_sent";

	switch (driveSession.assetsEmailStatus) {
		case "failed":
		case "sent":
			return driveSession.assetsEmailStatus;
		case undefined:
			return driveSession.assetsEmailClaimedAt === undefined ? "not_sent" : "pending";
		default: {
			const _exhaustive: never = driveSession.assetsEmailStatus;
			return _exhaustive;
		}
	}
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return ok(null);
		const normalizedEmail = booking.email.trim().toLowerCase();
		return okOrThrow(
			Promise.all([
				ctx.db
					.query("driveClients")
					.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
					.unique(),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique()
			])
		).map(([driveClient, driveSession]) => ({ booking, driveClient, driveSession }));
	});
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	clientFolder: { normalizedEmail: string; displayName: string; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) =>
				query.eq("normalizedEmail", clientFolder.normalizedEmail)
			)
			.unique()
	).andThen((existingClient) => {
		if (existingClient !== null) {
			return ok({ driveClientId: existingClient._id, folderId: existingClient.folderId });
		}
		return okOrThrow(
			ctx.db
				.insert("driveClients", {
					normalizedEmail: clientFolder.normalizedEmail,
					displayName: clientFolder.displayName,
					folderId: clientFolder.folder.id,
					folderUrl: clientFolder.folder.webViewLink,
					createdAt: Date.now()
				})
				.then((driveClientId) => ({ driveClientId, folderId: clientFolder.folder.id }))
		);
	});
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	sessionFolder: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: SavedDriveFolder;
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", sessionFolder.bookingId))
			.unique()
	).andThen((existingSession) => {
		// A repeated save must keep using the folder that won the first database write.
		if (existingSession?.sessionFolder !== undefined) return ok(existingSession.sessionFolder.id);
		// A previous attempt may have created the record before it saved the session folder.
		if (existingSession !== null) {
			return okOrThrow(
				ctx.db
					.patch(existingSession._id, {
						sessionFolder: { id: sessionFolder.folder.id, url: sessionFolder.folder.webViewLink },
						updatedAt: Date.now()
					})
					.then(() => sessionFolder.folder.id)
			);
		}
		return okOrThrow(
			ctx.db
				.insert("driveSessions", {
					bookingId: sessionFolder.bookingId,
					driveClientId: sessionFolder.driveClientId,
					sessionFolder: { id: sessionFolder.folder.id, url: sessionFolder.folder.webViewLink },
					createdAt: Date.now(),
					updatedAt: Date.now()
				})
				.then(() => sessionFolder.folder.id)
		);
	});
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode?: string }
) {
	return okOrThrow(
		ctx.db
			.patch(args.bookingId, {
				driveSetupFailedAt: args.failureCode === undefined ? undefined : Date.now(),
				driveSetupFailureCode: args.failureCode
			})
			.then(() => null)
	);
}

export function saveDriveChildFolder(
	ctx: MutationCtx,
	childFolder: { bookingId: Id<"bookings">; name: DriveChildFolderName; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", childFolder.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		let folderFields;
		switch (childFolder.name) {
			case "Raw Media":
				folderFields = {
					rawMediaFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
				break;
			case "Assets":
				folderFields = {
					assetsFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
				break;
			case "Deliverables":
				folderFields = {
					deliverablesFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
				break;
			default: {
				const exhaustiveName: never = childFolder.name;
				return exhaustiveName;
			}
		}
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, { ...folderFields, updatedAt: Date.now() })
				.then(() => driveSession._id)
		);
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
	status: Doc<"driveSessions">["assetsEmailStatus"]
) {
	switch (attempt) {
		case "automatic":
			return status === undefined;
		case "retry":
			return status === undefined || status === "failed";
		default: {
			const _exhaustive: never = attempt;
			return _exhaustive;
		}
	}
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return okOrThrow(
		Promise.all([
			ctx.db.get(args.bookingId),
			ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
				.unique()
		])
	).andThen(([booking, driveSession]) => {
		const assetsFolder = driveSession?.assetsFolder;
		if (
			booking === null ||
			driveSession === null ||
			driveSession.clientDrivePermissionsStatus !== "ready" ||
			assetsFolder === undefined ||
			driveSession.assetsEmailStatus === "sent" ||
			(driveSession.assetsEmailClaimedAt !== undefined &&
				args.now - driveSession.assetsEmailClaimedAt < CLIENT_ASSETS_EMAIL_CLAIM_TIMEOUT_MS) ||
			!canClaimClientAssetsEmail(args.attempt, driveSession.assetsEmailStatus)
		) {
			return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
		}

		return okOrThrow(
			ctx.db
				.patch(driveSession._id, { assetsEmailClaimedAt: args.now, updatedAt: Date.now() })
				.then(() => ({
					assetsUrl: assetsFolder.url,
					bookingId: booking._id,
					claimedAt: args.now,
					email: booking.email,
					name: booking.name
				}))
		);
	});
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; claimedAt: number; status: "sent" | "failed" }
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
					assetsEmailStatus: args.status,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}
