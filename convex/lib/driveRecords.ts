import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS, loadPackageBookings } from "#convex/lib/driveLookup";
import { okOrThrow } from "#convex/lib/result";
import type {
	DriveChildFolderName,
	SavedDriveFolder,
	SavedDrivePermission
} from "#convex/lib/googleDrive";

type ClientDrivePermissionsStatus = "failed" | "ready" | "skipped";

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
						.patch(existingClient._id, {
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
	return okOrThrow(ctx.db.get(args.driveClientId)).andThen((driveClient) => {
		if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		const assetsFolder = { id: args.folder.id, url: args.folder.webViewLink };
		if (driveClient.assetsFolder !== undefined && driveClient.assetsFolder.id === assetsFolder.id) {
			return ok(driveClient.assetsFolder);
		}
		return okOrThrow(ctx.db.patch(driveClient._id, { assetsFolder }).then(() => assetsFolder));
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
					.patch(driveSession._id, {
						packageFolder: { id: packageFolder.folder.id, url: packageFolder.folder.webViewLink },
						updatedAt: Date.now()
					})
					.then(() => packageFolder.folder.id)
			);
		}
		return okOrThrow(ctx.db.get(packageFolder.bookingId)).andThen((booking) => {
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

type PackageSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_NOT_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getPackageBooking(ctx, args.bookingId)
		.andThen((packageBooking) => resolvePackageSessionNumber(ctx, packageBooking))
		.andThen((allocation) => {
			// A retry re-enters with its number already saved; only fresh allocations write.
			if (allocation.kind === "already_saved") return okAsync(allocation.number);
			return savePackageSessionNumber(ctx, allocation);
		});
}

type PackageBooking = { booking: Doc<"bookings">; packageId: Id<"multiBookingPackages"> };

function getPackageBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<PackageBooking, PackageSessionNumberError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
		if (booking.multiBookingPackageId === undefined) {
			return err({ reason: "BOOKING_NOT_PACKAGE" as const });
		}
		return ok({ booking, packageId: booking.multiBookingPackageId });
	});
}

type PackageSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

// On a retry the saved number wins; otherwise the number is the session's position in the
// package's date order, skipping numbers other sessions already have.
function resolvePackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<PackageSessionNumberAllocation, PackageSessionNumberError> {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking.booking._id))
			.unique()
	).andThen((existingSession) => {
		if (existingSession?.packageSessionNumber !== undefined) {
			return okAsync({
				kind: "already_saved" as const,
				number: existingSession.packageSessionNumber
			});
		}
		return loadNextPackageSessionNumber(ctx, packageBooking).map((number) => ({
			kind: "new" as const,
			booking: packageBooking.booking,
			existingSession,
			number
		}));
	});
}

function loadNextPackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<number, PackageSessionNumberError> {
	return okOrThrow(loadPackageSessionsSortedByDate(ctx, packageBooking.packageId)).andThen(
		(scheduledSessions) => {
			const sessionIndex = scheduledSessions.findIndex(
				(item) => item._id === packageBooking.booking._id
			);
			if (sessionIndex === -1) {
				return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
			}
			return okOrThrow(loadSavedPackageSessionNumbers(ctx, packageBooking.packageId)).map(
				(savedNumbers) => {
					// Start at the session's date-order position and step past numbers already in use.
					let number = sessionIndex + 1;
					while (savedNumbers.has(number)) number += 1;
					return number;
				}
			);
		}
	);
}

function savePackageSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<PackageSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, PackageSessionNumberError> {
	if (allocation.existingSession !== null) {
		return okOrThrow(
			ctx.db
				.patch(allocation.existingSession._id, {
					packageSessionNumber: allocation.number,
					updatedAt: Date.now()
				})
				.then(() => allocation.number)
		);
	}
	if (allocation.booking.driveClientId === undefined) {
		return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}
	return okOrThrow(
		ctx.db
			.insert("driveSessions", {
				bookingId: allocation.booking._id,
				driveClientId: allocation.booking.driveClientId,
				packageSessionNumber: allocation.number,
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.then(() => allocation.number)
	);
}

// Numbers of sessions with a saved number stay reserved even when cancelled, because their
// folders already exist in Drive.
async function loadSavedPackageSessionNumbers(
	ctx: MutationCtx,
	multiBookingId: Id<"multiBookingPackages">
) {
	const savedNumbers = new Set<number>();
	const packageBookings = await loadPackageBookings(ctx, multiBookingId);
	await Promise.all(
		packageBookings.map(async (packageBooking) => {
			const driveSession = await ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
				.unique();
			if (driveSession?.packageSessionNumber !== undefined) {
				savedNumbers.add(driveSession.packageSessionNumber);
			}
		})
	);
	return savedNumbers;
}

async function loadPackageSessionsSortedByDate(
	ctx: MutationCtx,
	multiBookingId: Id<"multiBookingPackages">
) {
	return (await loadPackageBookings(ctx, multiBookingId))
		.filter((packageBooking) => packageBooking.status !== "cancelled")
		.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}

export type ClearSavedDriveFolderArgs =
	| { kind: "client"; driveClientId: Id<"driveClients"> }
	| { kind: "assets"; driveClientId: Id<"driveClients"> }
	| { kind: "package"; bookingId: Id<"bookings"> }
	| { kind: "session"; bookingId: Id<"bookings"> }
	| { kind: "child"; bookingId: Id<"bookings">; name: DriveChildFolderName };

export function clearSavedDriveFolder(ctx: MutationCtx, args: ClearSavedDriveFolderArgs) {
	switch (args.kind) {
		case "client":
			return okOrThrow(
				ctx.db
					.patch(args.driveClientId, { folderId: undefined, folderUrl: undefined })
					.then(() => null)
			);
		case "assets":
			return okOrThrow(
				ctx.db.patch(args.driveClientId, { assetsFolder: undefined }).then(() => null)
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
		default: {
			const _exhaustive: never = args;
			return _exhaustive;
		}
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
			ctx.db.patch(driveSession._id, { ...fields, updatedAt: Date.now() }).then(() => null)
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
