import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { loadDriveSessionRowByBookingId } from "#convex/lib/drive/driveBookingDriveClient";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/lib/drive/googleDrive";
import { okOrThrow } from "#convex/lib/result";

export function loadDriveClientByNormalizedEmail(ctx: MutationCtx, normalizedEmail: string) {
	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
			.unique()
	);
}

// The row starts without a folder; Drive setup creates and saves the client folder later.
export function getOrCreateDriveClientIdForRow(
	ctx: MutationCtx,
	existingClient: Doc<"driveClients"> | null,
	client: { email: string; displayName: string; normalizedEmail: string }
): ResultAsync<Id<"driveClients">, never> {
	if (existingClient !== null) return okAsync(existingClient._id);

	return okOrThrow(
		ctx.db.insert("driveClients", {
			normalizedEmail: client.normalizedEmail,
			displayName: client.displayName,
			createdAt: Date.now()
		})
	);
}

export function saveDriveClientFolderForRow(
	ctx: MutationCtx,
	existingClient: Doc<"driveClients"> | null,
	clientFolder: { normalizedEmail: string; displayName: string; folder: SavedDriveFolder }
) {
	if (existingClient !== null) {
		// The row was created at booking time, so it may have no folder yet.
		if (existingClient.folderId === undefined) {
			return okOrThrow(
				ctx.db
					.patch("driveClients", existingClient._id, {
						folderId: clientFolder.folder.id,
						folderUrl: clientFolder.folder.webViewLink
					})
					.then(() => null)
			).map(() => ({
				driveClientId: existingClient._id,
				folderId: clientFolder.folder.id,
				assetsFolder: existingClient.assetsFolder
			}));
		}

		return ok({
			driveClientId: existingClient._id,
			folderId: existingClient.folderId,
			assetsFolder: existingClient.assetsFolder
		});
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
			.then((driveClientId) => ({
				driveClientId,
				folderId: clientFolder.folder.id,
				assetsFolder: undefined
			}))
	);
}

export function saveDriveClientAssetsFolderForRow(
	ctx: MutationCtx,
	driveClient: Doc<"driveClients"> | null,
	args: { folder: SavedDriveFolder }
): ResultAsync<{ id: string; url: string }, { reason: "DRIVE_RECORD_NOT_FOUND" }> {
	if (driveClient === null) return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	const assetsFolder = { id: args.folder.id, url: args.folder.webViewLink };

	if (driveClient.assetsFolder !== undefined && driveClient.assetsFolder.id === assetsFolder.id) {
		return okAsync(driveClient.assetsFolder);
	}

	return okOrThrow(
		ctx.db.patch("driveClients", driveClient._id, { assetsFolder }).then(() => assetsFolder)
	);
}

export function saveDriveSessionFolderForRow(
	ctx: MutationCtx,
	existingSession: Doc<"driveSessions"> | null,
	sessionFolder: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: SavedDriveFolder;
	}
) {
	// A repeated save must keep using the folder that won the first database write.
	if (existingSession?.sessionFolder !== undefined) return ok(existingSession.sessionFolder.id);

	// A previous attempt may have created the record before it saved the session folder.
	if (existingSession !== null) {
		return okOrThrow(
			ctx.db
				.patch("driveSessions", existingSession._id, {
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
}

export function saveDrivePackageFolderForRow(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	packageFolder: { bookingId: Id<"bookings">; folder: SavedDriveFolder },
	booking: Doc<"bookings"> | null
) {
	// A repeated save must keep the package folder that won the first database write.
	if (driveSession?.packageFolder !== undefined) return ok(driveSession.packageFolder.id);

	if (driveSession !== null) {
		return okOrThrow(
			ctx.db
				.patch("driveSessions", driveSession._id, {
					packageFolder: { id: packageFolder.folder.id, url: packageFolder.folder.webViewLink },
					updatedAt: Date.now()
				})
				.then(() => packageFolder.folder.id)
		);
	}

	if (booking === null || booking.driveClientId === undefined) {
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return okOrThrow(
		ctx.db
			.insert("driveSessions", {
				bookingId: packageFolder.bookingId,
				driveClientId: booking.driveClientId,
				packageFolder: { id: packageFolder.folder.id, url: packageFolder.folder.webViewLink },
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.then(() => packageFolder.folder.id)
	);
}

export type ClearSavedDriveFolderArgs =
	| { kind: "client"; driveClientId: Id<"driveClients"> }
	| { kind: "assets"; driveClientId: Id<"driveClients"> }
	| { kind: "package"; bookingId: Id<"bookings"> }
	| { kind: "session"; bookingId: Id<"bookings"> }
	| { kind: "child"; bookingId: Id<"bookings">; name: DriveChildFolderName };

export function clearSavedDriveFolder(ctx: MutationCtx, args: ClearSavedDriveFolderArgs) {
	const folderKind = args.kind;

	switch (folderKind) {
		case "client":
			return okOrThrow(
				ctx.db
					.patch("driveClients", args.driveClientId, { folderId: undefined, folderUrl: undefined })
					.then(() => null)
			);
		case "assets":
			return okOrThrow(
				ctx.db
					.patch("driveClients", args.driveClientId, { assetsFolder: undefined })
					.then(() => null)
			);
		case "package":
			return clearDriveSessionFields(ctx, args.bookingId, { packageFolder: undefined });
		case "session":
			return clearDriveSessionFields(ctx, args.bookingId, {
				sessionFolder: undefined,
				rawMediaFolder: undefined,
				deliverablesFolder: undefined
			});
		case "child":
			return clearDriveSessionFields(
				ctx,
				args.bookingId,
				args.name === "Raw Media"
					? { rawMediaFolder: undefined }
					: { deliverablesFolder: undefined }
			);
		default:
			return exhaustiveCheck(folderKind);
	}
}

export function clearDriveSessionFieldsForRow(
	ctx: MutationCtx,
	fields: {
		packageFolder?: undefined;
		sessionFolder?: undefined;
		rawMediaFolder?: undefined;
		deliverablesFolder?: undefined;
	},
	driveSession: Doc<"driveSessions"> | null
) {
	if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, { ...fields, updatedAt: Date.now() })
			.then(() => null)
	);
}

function clearDriveSessionFields(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	fields: {
		packageFolder?: undefined;
		sessionFolder?: undefined;
		rawMediaFolder?: undefined;
		deliverablesFolder?: undefined;
	}
) {
	return loadDriveSessionRowByBookingId(ctx, bookingId).andThen((driveSession) =>
		clearDriveSessionFieldsForRow(ctx, fields, driveSession)
	);
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode?: string }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				driveSetupFailedAt: args.failureCode === undefined ? undefined : Date.now(),
				driveSetupFailureCode: args.failureCode
			})
			.then(() => null)
	);
}

export function saveDriveChildFolderForRow(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	childFolder: { name: DriveChildFolderName; folder: SavedDriveFolder }
) {
	if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	const folderFields = (() => {
		switch (childFolder.name) {
			case "Raw Media":
				return {
					rawMediaFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
			case "Deliverables":
				return {
					deliverablesFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
			default:
				return exhaustiveCheck(childFolder.name);
		}
	})();

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, { ...folderFields, updatedAt: Date.now() })
			.then(() => driveSession._id)
	);
}
