"use node";

import { ResultAsync, err, ok, okAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { fromConvexTuple } from "#convex/lib/result";
import {
	createDriveFolder,
	findDriveFolderByMarker,
	getClientFolderName,
	getPackageFolderName,
	getPackageSessionFolderName,
	getSessionFolderName,
	getSessionMediaFolderName,
	loadDriveClient,
	normalizeDriveEmail,
	renameDriveFolder,
	verifyDriveFolder,
	GOOGLE_DRIVE_CHILD_FOLDER_NAMES,
	type DriveChildFolderName,
	type DriveClient,
	type DriveError,
	type SavedDriveFolder
} from "#convex/lib/googleDrive";

type SavedFolder = { id: string; url: string };

type SetupPackage = {
	_id: Id<"multiBookingPackages">;
	packageSize: Doc<"multiBookingPackages">["packageSize"];
	paidAt?: number;
	createdAt: number;
};

export type DriveSetupInfo = {
	booking: {
		_id: Id<"bookings">;
		name: string;
		accountName: string;
		email: string;
		sessionStartAt: number;
		duration: string;
		status: Doc<"bookings">["status"];
		multiBookingPackageId?: Id<"multiBookingPackages">;
	};
	multiBookingPackage: SetupPackage | null;
	driveClient: {
		_id: Id<"driveClients">;
		normalizedEmail: string;
		displayName: string;
		folderId?: string;
		assetsFolder?: SavedFolder;
	} | null;
	driveSession: {
		_id: Id<"driveSessions">;
		packageSessionNumber?: number;
		packageFolder?: SavedFolder;
		sessionFolder?: SavedFolder;
		rawMediaFolder?: SavedFolder;
		deliverablesFolder?: SavedFolder;
	} | null;
	sharedPackageFolder?: SavedFolder;
};

export type SetupError =
	| DriveError
	| {
			reason:
				| "NOT_AUTHENTICATED"
				| "NOT_AUTHORIZED"
				| "DRIVE_RECORD_NOT_FOUND"
				| "BOOKING_NOT_FOUND"
				| "BOOKING_NOT_ELIGIBLE"
				| "BOOKING_TIMING_CHANGED"
				| "DRIVE_FOLDERS_ALREADY_CREATED"
				| "DRIVE_FOLDERS_INCOMPLETE"
				| "GOOGLE_DRIVE_SAVE_FAILED";
	  };

export function areDriveSetupFoldersSaved(setupInfo: DriveSetupInfo | null) {
	if (setupInfo === null) return false;
	const { driveClient, driveSession, multiBookingPackage, sharedPackageFolder } = setupInfo;
	if (driveClient?.folderId === undefined || driveClient.assetsFolder === undefined) return false;
	if (driveSession === null || driveSession.sessionFolder === undefined) return false;
	if (driveSession.rawMediaFolder === undefined || driveSession.deliverablesFolder === undefined) {
		return false;
	}
	if (
		multiBookingPackage !== null &&
		driveSession.packageFolder === undefined &&
		sharedPackageFolder === undefined
	) {
		return false;
	}
	return true;
}

const recordDriveSetupFailureByReason = {
	GOOGLE_DRIVE_AUTH_FAILED: true,
	GOOGLE_DRIVE_FOLDER_CREATE_FAILED: true,
	GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID: true,
	GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED: true,
	GOOGLE_DRIVE_FOLDER_MISSING: true,
	GOOGLE_DRIVE_FOLDER_RENAME_FAILED: true,
	GOOGLE_DRIVE_PERMISSION_CREATE_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_DELETE_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID: false,
	GOOGLE_DRIVE_SAVE_FAILED: true,
	DRIVE_RECORD_NOT_FOUND: true,
	NOT_AUTHENTICATED: false,
	NOT_AUTHORIZED: false,
	BOOKING_NOT_FOUND: false,
	BOOKING_NOT_ELIGIBLE: false,
	BOOKING_TIMING_CHANGED: false,
	DRIVE_FOLDERS_ALREADY_CREATED: false,
	DRIVE_FOLDERS_INCOMPLETE: true
} satisfies Record<SetupError["reason"], boolean>;

export function shouldRecordDriveSetupFailure(error: SetupError) {
	return recordDriveSetupFailureByReason[error.reason];
}

export function validateDriveSetup(
	setupInfo: DriveSetupInfo | null,
	expectedTiming?: { sessionStartAt: number; duration: string }
) {
	if (setupInfo === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
	if (setupInfo.booking.status !== "confirmed" && setupInfo.booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_ELIGIBLE" as const });
	}
	if (
		expectedTiming !== undefined &&
		(setupInfo.booking.sessionStartAt !== expectedTiming.sessionStartAt ||
			setupInfo.booking.duration !== expectedTiming.duration)
	) {
		return err({ reason: "BOOKING_TIMING_CHANGED" as const });
	}
	return ok(setupInfo);
}

function buildFolderMarker(bookingId: Id<"bookings">, role: string) {
	return `${bookingId}:${role}`;
}

function getClientIdentity(setupInfo: DriveSetupInfo) {
	if (setupInfo.driveClient !== null) {
		return {
			displayName: setupInfo.driveClient.displayName,
			normalizedEmail: setupInfo.driveClient.normalizedEmail
		};
	}
	return {
		displayName: getClientFolderName({
			accountName: setupInfo.booking.accountName,
			contactName: setupInfo.booking.name
		}),
		normalizedEmail: normalizeDriveEmail(setupInfo.booking.email)
	};
}

function verifyAndRenameDriveFolder(drive: DriveClient, folderId: string, expectedName: string) {
	return verifyDriveFolder(drive, folderId).andThen((folder) => {
		if (folder.name === expectedName) return ok(folder);
		return renameDriveFolder(drive, { folderId: folder.id, name: expectedName });
	});
}

// If Google's create response is lost, find the folder by its private booking marker.
function createFolderOrFindCreatedFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return findDriveFolderByMarker(drive, input).andThen((folder) => {
		if (folder !== null) return ok(folder);
		return createDriveFolder(drive, input).orElse((createError) =>
			findDriveFolderByMarker(drive, input).andThen((foundFolder) =>
				foundFolder === null ? err(createError) : ok(foundFolder)
			)
		);
	});
}

type ClientFolderSetup = {
	drive: DriveClient;
	clientFolderId: string;
	driveClientId: Id<"driveClients">;
	assetsFolder?: SavedFolder;
};

type SessionFolderSetup = { drive: DriveClient; sessionFolderId: string };

function shouldReplaceMissingFolder(error: SetupError, replaceMissingFolders: boolean) {
	return replaceMissingFolders && error.reason === "GOOGLE_DRIVE_FOLDER_MISSING";
}

function clearSavedClientFolder(ctx: ActionCtx, driveClientId: Id<"driveClients">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearDriveClientFolder, { driveClientId })
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

function clearSavedClientAssetsFolder(ctx: ActionCtx, driveClientId: Id<"driveClients">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearDriveClientAssetsFolder, { driveClientId })
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

function clearSavedPackageFolder(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearDrivePackageFolder, { bookingId })
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

function clearSavedSessionFolder(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearDriveSessionFolder, { bookingId })
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

function clearSavedChildFolder(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	name: DriveChildFolderName
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearDriveChildFolder, { bookingId, name })
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

function getOrCreateClientFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup, SetupError> {
	const savedClient = setupInfo.driveClient;
	const savedClientFolderId = savedClient?.folderId;
	if (savedClient !== null && savedClientFolderId !== undefined) {
		return verifyDriveFolder(drive, savedClientFolderId)
			.map(() => ({
				drive,
				clientFolderId: savedClientFolderId,
				driveClientId: savedClient._id,
				assetsFolder: savedClient.assetsFolder
			}))
			.orElse((error) => {
				if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
				savedClient.folderId = undefined;
				return clearSavedClientFolder(ctx, savedClient._id).andThen(() =>
					getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders)
				);
			});
	}

	const { displayName, normalizedEmail } = getClientIdentity(setupInfo);
	return createFolderOrFindCreatedFolder(drive, {
		name: displayName,
		parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
		marker: `client:${normalizedEmail}`
	}).andThen((folder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessions.saveDriveClientFolder, {
				normalizedEmail,
				displayName,
				folder
			})
		)
			.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			.map(({ assetsFolder, driveClientId, folderId }) => ({
				drive,
				clientFolderId: folderId,
				driveClientId,
				assetsFolder
			}))
	);
}

function getOrCreateClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { assetsFolder: SavedFolder }, SetupError> {
	const savedAssetsFolder = client.assetsFolder;
	if (savedAssetsFolder !== undefined) {
		return verifyDriveFolder(client.drive, savedAssetsFolder.id)
			.map(() => ({ ...client, assetsFolder: savedAssetsFolder }))
			.orElse((error) => {
				if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
				client.assetsFolder = undefined;
				if (setupInfo.driveClient !== null) setupInfo.driveClient.assetsFolder = undefined;
				return clearSavedClientAssetsFolder(ctx, client.driveClientId).andThen(() =>
					getOrCreateClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders)
				);
			});
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: "_Assets",
		parentId: client.clientFolderId,
		marker: `client:${getClientIdentity(setupInfo).normalizedEmail}:assets`
	})
		.andThen((folder) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.saveDriveClientAssetsFolder, {
					driveClientId: client.driveClientId,
					folder
				})
			).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
		)
		.map((assetsFolder) => ({ ...client, assetsFolder }));
}

function getOrCreateSessionFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	input: {
		drive: DriveClient;
		driveClientId: Id<"driveClients">;
		sessionParentId: string;
		packageSessionNumber: number | null;
		replaceMissingFolders: boolean;
	}
): ResultAsync<SessionFolderSetup, SetupError> {
	const savedFolder = setupInfo.driveSession?.sessionFolder;
	if (savedFolder !== undefined) {
		return verifyAndRenameDriveFolder(
			input.drive,
			savedFolder.id,
			getSessionFolderDisplayName(setupInfo.booking.sessionStartAt, input.packageSessionNumber)
		)
			.map((folder) => ({ drive: input.drive, sessionFolderId: folder.id }))
			.orElse((error) => {
				if (!shouldReplaceMissingFolder(error, input.replaceMissingFolders)) return err(error);
				if (setupInfo.driveSession !== null) {
					setupInfo.driveSession.sessionFolder = undefined;
					setupInfo.driveSession.rawMediaFolder = undefined;
					setupInfo.driveSession.deliverablesFolder = undefined;
				}
				return clearSavedSessionFolder(ctx, setupInfo.booking._id).andThen(() =>
					getOrCreateSessionFolder(ctx, setupInfo, input)
				);
			});
	}

	return createFolderOrFindCreatedFolder(input.drive, {
		name: getSessionFolderDisplayName(setupInfo.booking.sessionStartAt, input.packageSessionNumber),
		parentId: input.sessionParentId,
		marker: buildFolderMarker(setupInfo.booking._id, "session")
	}).andThen((folder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessions.saveDriveSessionFolder, {
				bookingId: setupInfo.booking._id,
				driveClientId: input.driveClientId,
				folder
			})
		)
			.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			.map((sessionFolderId) => ({ drive: input.drive, sessionFolderId }))
	);
}

function getSessionFolderDisplayName(sessionStartAt: number, packageSessionNumber: number | null) {
	return packageSessionNumber === null
		? getSessionFolderName(sessionStartAt)
		: getPackageSessionFolderName(packageSessionNumber, sessionStartAt);
}

function savedChildFolder(setupInfo: DriveSetupInfo, name: DriveChildFolderName) {
	switch (name) {
		case "Raw Media":
			return setupInfo.driveSession?.rawMediaFolder;
		case "Deliverables":
			return setupInfo.driveSession?.deliverablesFolder;
		default: {
			const _exhaustive: never = name;
			return _exhaustive;
		}
	}
}

function getOrCreateChildFolder(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
): ResultAsync<SavedDriveFolder, SetupError> {
	const savedFolder = savedChildFolder(setupInfo, name);
	if (savedFolder !== undefined) {
		return verifyAndRenameDriveFolder(
			drive,
			savedFolder.id,
			getSessionMediaFolderName(name, setupInfo.booking.sessionStartAt)
		).orElse((error) => {
			if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
			if (setupInfo.driveSession !== null && name === "Raw Media") {
				setupInfo.driveSession.rawMediaFolder = undefined;
			}
			if (setupInfo.driveSession !== null && name === "Deliverables") {
				setupInfo.driveSession.deliverablesFolder = undefined;
			}
			return clearSavedChildFolder(ctx, setupInfo.booking._id, name).andThen(() =>
				getOrCreateChildFolder(ctx, drive, setupInfo, sessionFolderId, name, replaceMissingFolders)
			);
		});
	}

	return createFolderOrFindCreatedFolder(drive, {
		name: getSessionMediaFolderName(name, setupInfo.booking.sessionStartAt),
		parentId: sessionFolderId,
		marker: buildFolderMarker(setupInfo.booking._id, name.toLowerCase().replaceAll(" ", "_"))
	}).andThen((folder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessions.saveDriveChildFolder, {
				bookingId: setupInfo.booking._id,
				name,
				folder
			})
		)
			.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			.map(() => folder)
	);
}

function getOrCreateChildFolders(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	replaceMissingFolders: boolean
) {
	// Save each folder before creating the next so retries resume from the first unsaved folder.
	let sequence: ResultAsync<null, SetupError> = okAsync(null);
	for (const name of GOOGLE_DRIVE_CHILD_FOLDER_NAMES) {
		sequence = sequence.andThen(() =>
			getOrCreateChildFolder(
				ctx,
				drive,
				setupInfo,
				sessionFolderId,
				name,
				replaceMissingFolders
			).map(() => null)
		);
	}
	return sequence;
}

// Package sessions must have their permanent number saved before any Drive call so retries
// keep it stable and concurrent setups of one package cannot allocate the same number.
function allocatePackageSessionNumberIfNeeded(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo
): ResultAsync<number | null, SetupError> {
	if (setupInfo.multiBookingPackage === null) return okAsync(null);
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.allocatePackageSessionNumber, {
			bookingId: setupInfo.booking._id
		})
	).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }));
}

// Package sessions live inside their package folder; ordinary sessions sit directly below
// the client folder.
function getOrCreateSessionParentFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { sessionParentId: string }, SetupError> {
	if (setupInfo.multiBookingPackage === null) {
		return okAsync({ ...client, sessionParentId: client.clientFolderId });
	}

	const ownPackageFolder = setupInfo.driveSession?.packageFolder;
	if (ownPackageFolder !== undefined) {
		return verifyDriveFolder(client.drive, ownPackageFolder.id)
			.map(() => ({ ...client, sessionParentId: ownPackageFolder.id }))
			.orElse((error) => {
				if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
				if (setupInfo.driveSession !== null) setupInfo.driveSession.packageFolder = undefined;
				return clearSavedPackageFolder(ctx, setupInfo.booking._id).andThen(() =>
					getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders)
				);
			});
	}

	const packageFolderName = getPackageFolderName({
		packageSize: setupInfo.multiBookingPackage.packageSize,
		purchasedAt: setupInfo.multiBookingPackage.paidAt ?? setupInfo.multiBookingPackage.createdAt
	});
	const sharedPackageFolder = setupInfo.sharedPackageFolder;
	// A sibling session already created the package folder; link it to this booking.
	if (sharedPackageFolder !== undefined) {
		return verifyDriveFolder(client.drive, sharedPackageFolder.id)
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessions.saveDrivePackageFolder, {
						bookingId: setupInfo.booking._id,
						folder: {
							id: sharedPackageFolder.id,
							name: packageFolderName,
							webViewLink: sharedPackageFolder.url
						}
					})
				).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			)
			.map((sessionParentId) => ({ ...client, sessionParentId }))
			.orElse((error) => {
				if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
				setupInfo.sharedPackageFolder = undefined;
				return getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders);
			});
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: packageFolderName,
		parentId: client.clientFolderId,
		// The marker is derived from the package so every session of the package finds it.
		marker: `package:${setupInfo.multiBookingPackage._id}`
	})
		.andThen((folder) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.saveDrivePackageFolder, {
					bookingId: setupInfo.booking._id,
					folder
				})
			).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
		)
		.map((sessionParentId) => ({ ...client, sessionParentId }));
}

export function createDriveFolders(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders = false
): ResultAsync<null, SetupError> {
	return allocatePackageSessionNumberIfNeeded(ctx, setupInfo)
		.andThen((packageSessionNumber) =>
			loadDriveClient()
				.andThen((drive) => getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders))
				.andThen((client) =>
					getOrCreateClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders)
				)
				.andThen((client) =>
					getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders)
				)
				.andThen((parent) =>
					getOrCreateSessionFolder(ctx, setupInfo, {
						drive: parent.drive,
						driveClientId: parent.driveClientId,
						sessionParentId: parent.sessionParentId,
						packageSessionNumber,
						replaceMissingFolders
					})
				)
				.andThen(({ drive, sessionFolderId }) =>
					getOrCreateChildFolders(ctx, drive, setupInfo, sessionFolderId, replaceMissingFolders)
				)
		)
		.map(() => null);
}
