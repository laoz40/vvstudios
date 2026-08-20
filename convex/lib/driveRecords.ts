import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/lib/googleDrive";

export function buildDriveStatus(driveSession: Doc<"driveSessions"> | null) {
	if (driveSession === null) return { status: "not_created" as const };

	const folders = [
		{ name: "Session", url: driveSession.sessionFolderUrl },
		{ name: "Raw Media", url: driveSession.rawMediaFolderUrl },
		{ name: "Assets", url: driveSession.assetsFolderUrl },
		{ name: "Deliverables", url: driveSession.deliverablesFolderUrl }
	] satisfies Array<{ name: "Session" | DriveChildFolderName; url: string | undefined }>;

	// Child folders are created in order. Deliverables can only exist after Raw Media access is limited.
	const isReady = folders.every((folder) => folder.url !== undefined);
	return { status: isReady ? ("ready" as const) : ("incomplete" as const), folders };
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
		ctx.db.insert("driveClients", {
			normalizedEmail: clientFolder.normalizedEmail,
			displayName: clientFolder.displayName,
			folderId: clientFolder.folder.id,
			folderUrl: clientFolder.folder.webViewLink,
			createdAt: Date.now()
		})
	);
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
		ctx.db.insert("driveSessions", {
			bookingId: sessionFolder.bookingId,
			driveClientId: sessionFolder.driveClientId,
			sessionFolderId: sessionFolder.folder.id,
			sessionFolderUrl: sessionFolder.folder.webViewLink,
			createdAt: Date.now(),
			updatedAt: Date.now()
		})
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
					rawMediaFolderId: childFolder.folder.id,
					rawMediaFolderUrl: childFolder.folder.webViewLink
				};
				break;
			case "Assets":
				folderFields = {
					assetsFolderId: childFolder.folder.id,
					assetsFolderUrl: childFolder.folder.webViewLink
				};
				break;
			case "Deliverables":
				folderFields = {
					deliverablesFolderId: childFolder.folder.id,
					deliverablesFolderUrl: childFolder.folder.webViewLink
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
