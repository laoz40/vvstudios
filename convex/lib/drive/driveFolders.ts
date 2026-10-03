import { err, ok, type ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { ensureBookingDriveClientId } from "#convex/lib/drive/driveBookingDriveClient";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/lib/drive/googleDrive";
import { okOrThrow } from "#convex/lib/result";

// The row starts without a folder; Drive setup creates and saves the client folder later.
export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
): ResultAsync<Id<"driveClients">, never> {
	const normalizedEmail = client.email.trim().toLowerCase();

	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
			.unique()
	).andThen((existingClient) => {
		if (existingClient !== null) return ok(existingClient._id);

		return okOrThrow(
			ctx.db.insert("driveClients", {
				normalizedEmail,
				displayName: client.displayName,
				createdAt: Date.now()
			})
		);
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
	});
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: { driveClientId: Id<"driveClients">; folder: SavedDriveFolder }
): ResultAsync<{ id: string; url: string }, { reason: "DRIVE_RECORD_NOT_FOUND" }> {
	return okOrThrow(ctx.db.get("driveClients", args.driveClientId)).andThen((driveClient) => {
		if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		const assetsFolder = { id: args.folder.id, url: args.folder.webViewLink };

		if (driveClient.assetsFolder !== undefined && driveClient.assetsFolder.id === assetsFolder.id) {
			return ok(driveClient.assetsFolder);
		}

		return okOrThrow(
			ctx.db.patch("driveClients", driveClient._id, { assetsFolder }).then(() => assetsFolder)
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
	)
		.andThen((existingSession) => {
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
		})
		.andThen((folderId) =>
			ensureBookingDriveClientId(ctx, sessionFolder.bookingId, sessionFolder.driveClientId).map(
				() => folderId
			)
		);
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	packageFolder: { bookingId: Id<"bookings">; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageFolder.bookingId))
			.unique()
	).andThen((driveSession) => {
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

		return okOrThrow(ctx.db.get("bookings", packageFolder.bookingId)).andThen((booking) => {
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
		});
	});
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
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return okOrThrow(
			ctx.db
				.patch("driveSessions", driveSession._id, { ...fields, updatedAt: Date.now() })
				.then(() => null)
		);
	});
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
	});
}
