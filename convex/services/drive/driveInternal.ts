import { err, errAsync, ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { bookingRequiresClientAssetsEmail } from "#convex/lib/booking/bookingAddonQuantities";
import {
	claimClientAssetsEmailRecord,
	saveClientAssetsEmailResultForSession,
	writeClientDrivePermission,
	writeClientDrivePermissionsStatusForSession
} from "#convex/lib/drive/driveClientAccess";
import {
	linkBookingDriveClientFromRow,
	loadBookingRow,
	loadClientAssetsEmailRows,
	loadDriveClientRow,
	loadDriveSessionRow,
	loadDriveSessionRowByBookingId,
	syncBookingDriveClientIdFromSessionRows
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	loadPackageBookings,
	resolveDriveClientForBooking,
	type DriveSetupInfo
} from "#convex/lib/drive/driveLookup";
import {
	loadDriveSetupPackageRecord,
	packageFolderFromOtherPackageBookings
} from "#convex/lib/drive/driveSetupLoad";
import {
	clientSessionNumberFromExistingSession,
	packageSessionNumberFromExistingSession,
	saveClientSessionNumber,
	savePackageSessionNumber,
	type PackageBooking,
	type StandaloneBooking
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import {
	claimEditorAssignmentEmailForEditor,
	clearPreviousEditorDriveAccessForSession,
	editorDriveAccessToRemoveForSession,
	editorDriveSetupFromLoaded,
	failedEditorRemovalForSession,
	loadEditorClientDriveData,
	loadEditorProfileByToken,
	markPreviousEditorRemovalFailedForSession,
	saveEditorAssignmentEmailResultForSession,
	writeEditorDrivePermission,
	writeEditorDrivePermissionsStatus
} from "#convex/lib/drive/driveEditor";
import {
	clearSavedDriveFolder as clearSavedDriveFolderLib,
	getOrCreateDriveClientIdForRow,
	loadDriveClientByNormalizedEmail,
	saveDriveChildFolderForRow,
	saveDriveClientAssetsFolderForRow,
	saveDriveClientFolderForRow,
	saveDrivePackageFolderForRow,
	saveDriveSessionFolderForRow,
	saveDriveSetupResult as saveDriveSetupResultLib
} from "#convex/lib/drive/driveFolders";
import { clearSessionDriveDbForSession } from "#convex/lib/drive/sessionFolders/clearSessionRecords";

function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"packages">,
	currentBookingId: Id<"bookings">
) {
	return loadPackageBookings(ctx, packageId).andThen((packageBookings) =>
		packageFolderFromOtherPackageBookings(ctx, packageBookings, currentBookingId)
	);
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen((booking) => {
		if (booking === null) return ok(null);

		const driveClientFromBookingResult =
			booking.driveClientId !== undefined
				? loadDriveClientRow(ctx, booking.driveClientId)
				: okAsync<Doc<"driveClients"> | null>(null);

		const driveSessionResult = loadDriveSessionRowByBookingId(ctx, bookingId);
		const packageRecordResult = loadDriveSetupPackageRecord(ctx, booking.packageId);

		return driveClientFromBookingResult.andThen((driveClientFromBooking) =>
			driveSessionResult.andThen((driveSession) =>
				packageRecordResult.andThen((packageRecord) =>
					resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking).andThen(
						(driveClient) => {
							if (driveSession?.packageFolder !== undefined || booking.packageId === undefined) {
								return ok({
									booking,
									driveClient,
									driveSession,
									packageRecord,
									sharedPackageFolder: undefined
								} satisfies DriveSetupInfo);
							}

							return loadSharedPackageFolder(ctx, booking.packageId, booking._id).map(
								(sharedPackageFolder) =>
									({
										booking,
										driveClient,
										driveSession,
										packageRecord,
										sharedPackageFolder
									}) satisfies DriveSetupInfo
							);
						}
					)
				)
			)
		);
	});
}

function standaloneBookingFromRow(ctx: MutationCtx, booking: Doc<"bookings"> | null) {
	if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

	if (booking.packageId !== undefined) {
		return errAsync({ reason: "BOOKING_IS_PACKAGE" as const });
	}

	if (booking.driveClientId !== undefined) {
		return okAsync({ booking, driveClientId: booking.driveClientId } satisfies StandaloneBooking);
	}

	return loadDriveClientByNormalizedEmail(ctx, booking.email.trim().toLowerCase()).andThen(
		(driveClient) => {
			if (driveClient === null) return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

			return okAsync({ booking, driveClientId: driveClient._id } satisfies StandaloneBooking);
		}
	);
}

function packageBookingFromRow(booking: Doc<"bookings"> | null) {
	if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

	if (booking.packageId === undefined) {
		return errAsync({ reason: "BOOKING_NOT_PACKAGE" as const });
	}

	return okAsync({ booking, packageId: booking.packageId } satisfies PackageBooking);
}

export function linkBookingDriveClient(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return loadBookingRow(ctx, bookingId).andThen((booking) =>
		linkBookingDriveClientFromRow(ctx, booking, bookingId, driveClientId)
	);
}

export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
) {
	const normalizedEmail = client.email.trim().toLowerCase();

	return loadDriveClientByNormalizedEmail(ctx, normalizedEmail).andThen((existingClient) =>
		getOrCreateDriveClientIdForRow(ctx, existingClient, { ...client, normalizedEmail })
	);
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return loadDriveClientByNormalizedEmail(ctx, args.normalizedEmail).andThen((existingClient) =>
		saveDriveClientFolderForRow(ctx, existingClient, args)
	);
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveSessionFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId)
		.andThen((existingSession) => saveDriveSessionFolderForRow(ctx, existingSession, args))
		.andThen((folderId) =>
			linkBookingDriveClient(ctx, args.bookingId, args.driveClientId).map(() => folderId)
		);
}

export function syncBookingDriveClientIdFromSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen((booking) =>
		loadDriveSessionRowByBookingId(ctx, bookingId).andThen((driveSession) =>
			syncBookingDriveClientIdFromSessionRows(ctx, booking, bookingId, driveSession)
		)
	);
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		folder: Parameters<typeof saveDrivePackageFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) => {
		if (driveSession !== null) {
			return saveDrivePackageFolderForRow(ctx, driveSession, args, null);
		}

		return loadBookingRow(ctx, args.bookingId).andThen((booking) =>
			saveDrivePackageFolderForRow(ctx, null, args, booking)
		);
	});
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen((booking) => packageBookingFromRow(booking))
		.andThen((packageBooking) =>
			loadDriveSessionRowByBookingId(ctx, packageBooking.booking._id).andThen((existingSession) =>
				packageSessionNumberFromExistingSession(ctx, existingSession, packageBooking)
			)
		)
		.andThen((allocation) => {
			if (allocation.kind === "already_saved") return okAsync(allocation.number);

			return savePackageSessionNumber(ctx, allocation);
		});
}

export function allocateClientSessionNumber(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen((booking) => standaloneBookingFromRow(ctx, booking))
		.andThen((standaloneBooking) =>
			loadDriveSessionRowByBookingId(ctx, standaloneBooking.booking._id).andThen(
				(existingSession) =>
					clientSessionNumberFromExistingSession(ctx, existingSession, standaloneBooking)
			)
		)
		.andThen((allocation) => {
			if (allocation.kind === "already_saved") return okAsync(allocation.number);

			return saveClientSessionNumber(ctx, allocation);
		});
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: {
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveClientAssetsFolderForRow>[2]["folder"];
	}
) {
	return loadDriveClientRow(ctx, args.driveClientId).andThen((driveClient) =>
		saveDriveClientAssetsFolderForRow(ctx, driveClient, args)
	);
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSetupResultLib>[1]
) {
	return saveDriveSetupResultLib(ctx, args);
}

export function clearSavedDriveFolder(
	ctx: MutationCtx,
	args: Parameters<typeof clearSavedDriveFolderLib>[1]
) {
	return clearSavedDriveFolderLib(ctx, args);
}

export function saveDriveChildFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: Parameters<typeof saveDriveChildFolderForRow>[2]["name"];
		folder: Parameters<typeof saveDriveChildFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		saveDriveChildFolderForRow(ctx, driveSession, args)
	);
}

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setup) => {
		const editorTokenIdentifier = setup?.booking.assignedEditorTokenIdentifier;

		if (editorTokenIdentifier === undefined) {
			return editorDriveSetupFromLoaded(setup, null);
		}

		return loadEditorProfileByToken(ctx, editorTokenIdentifier).andThen((editor) =>
			editorDriveSetupFromLoaded(setup, editor)
		);
	});
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		editorDriveAccessToRemoveForSession(ctx, driveSession, args)
	);
}

export function clearPreviousEditorDriveAccess(
	ctx: MutationCtx,
	args: {
		driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
	}
) {
	return loadDriveSessionRow(ctx, args.driveSessionId).andThen((driveSession) =>
		clearPreviousEditorDriveAccessForSession(ctx, driveSession, args)
	);
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		markPreviousEditorRemovalFailedForSession(ctx, driveSession, args)
	);
}

export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSessionRowByBookingId(ctx, bookingId).andThen((driveSession) => {
		const editorTokenIdentifier = driveSession?.failedRemovalEditorTokenIdentifier;

		if (driveSession === null || editorTokenIdentifier === undefined) {
			return okAsync(null);
		}

		return loadEditorClientDriveData(ctx, driveSession, editorTokenIdentifier).andThen(
			(clientData) =>
				loadEditorProfileByToken(ctx, editorTokenIdentifier).map((editor) =>
					failedEditorRemovalForSession(driveSession, bookingId, editor, clientData)
				)
		);
	});
}

export function saveEditorDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: Parameters<typeof writeEditorDrivePermission>[2]["permission"];
	}
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup === null ||
			setup.driveClient === null ||
			setup.driveSession === null ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		return writeEditorDrivePermission(
			ctx,
			{ driveClient: setup.driveClient, driveSession: setup.driveSession },
			args
		);
	});
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		return writeEditorDrivePermissionsStatus(ctx, setup.driveSession, args);
	});
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (setup === null) {
			return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
		}

		const driveSession = setup.driveSession;

		if (
			driveSession === null ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier ||
			driveSession.editorDrivePermissionsStatus !== "ready" ||
			driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
		}

		return loadEditorProfileByToken(ctx, args.editorTokenIdentifier).andThen((editor) =>
			claimEditorAssignmentEmailForEditor(ctx, { ...setup, driveSession }, args, editor)
		);
	});
}

export function saveEditorAssignmentEmailResult(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		claimedAt: number;
		editorTokenIdentifier: string;
		status: "failed" | "sent";
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		saveEditorAssignmentEmailResultForSession(ctx, driveSession, args)
	);
}

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: Parameters<typeof writeClientDrivePermission>[2]["permission"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return loadDriveClientRow(ctx, driveSession.driveClientId).andThen((driveClient) => {
			if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

			return writeClientDrivePermission(ctx, driveClient, args);
		});
	});
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: "failed" | "ready" | "skipped" }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return writeClientDrivePermissionsStatusForSession(ctx, driveSession, args.status);
	});
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return loadBookingRow(ctx, args.bookingId).andThen((booking) => {
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
		}).andThen(([driveClient, driveSession]) => {
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
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		saveClientAssetsEmailResultForSession(ctx, driveSession, args)
	);
}

export function clearSessionDriveDb(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) =>
		clearSessionDriveDbForSession(ctx, driveSession)
	);
}
