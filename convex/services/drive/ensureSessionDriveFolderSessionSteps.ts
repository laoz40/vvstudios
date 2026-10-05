"use node";

import { exhaustiveCheck } from "#/lib/result";

import { ResultAsync, err, okAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/lib/result";
import {
	getPackageFolderName,
	getPackageSessionFolderName,
	getSessionMediaFolderName,
	verifyDriveFolder,
	GOOGLE_DRIVE_CHILD_FOLDER_NAMES,
	type DriveChildFolderName,
	type DriveClient,
	type SavedDriveFolder
} from "#convex/lib/drive/googleDrive";
import {
	buildFolderMarker,
	clearSavedChildFolder,
	clearSavedPackageFolder,
	clearSavedSessionFolder,
	createFolderOrFindCreatedFolder,
	returnNull,
	shouldReplaceMissingFolder,
	verifyAndRenameDriveFolder,
	type ClientFolderSetup,
	type SessionFolderSetup
} from "#convex/services/drive/ensureSessionDriveFolderHelpers";

export function getOrCreateSessionFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	input: {
		drive: DriveClient;
		driveClientId: Id<"driveClients">;
		sessionParentId: string;
		sessionFolderNumber: number;
		replaceMissingFolders: boolean;
	}
): ResultAsync<SessionFolderSetup, SetupError> {
	const savedFolder = setupInfo.driveSession?.sessionFolder;

	if (savedFolder !== undefined) {
		return verifyAndRenameDriveFolder(
			input.drive,
			savedFolder.id,
			getSessionFolderDisplayName(setupInfo.booking.sessionStartAt, input.sessionFolderNumber)
		)
			.map(mapVerifiedSessionFolderSetup(input.drive))
			.orElse(recreateSessionFolderAfterMissing(ctx, setupInfo, input));
	}

	return createFolderOrFindCreatedFolder(input.drive, {
		name: getSessionFolderDisplayName(setupInfo.booking.sessionStartAt, input.sessionFolderNumber),
		parentId: input.sessionParentId,
		marker: buildFolderMarker(setupInfo.booking._id, "session")
	}).andThen(saveCreatedSessionFolder(ctx, setupInfo, input));
}

function mapVerifiedSessionFolderSetup(drive: DriveClient) {
	return (folder: SavedDriveFolder) => ({ drive, sessionFolderId: folder.id });
}

function recreateSessionFolderAfterMissing(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	input: Parameters<typeof getOrCreateSessionFolder>[2]
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, input.replaceMissingFolders)) return err(error);

		if (setupInfo.driveSession !== null) {
			setupInfo.driveSession.sessionFolder = undefined;
			setupInfo.driveSession.rawMediaFolder = undefined;
			setupInfo.driveSession.deliverablesFolder = undefined;
		}

		return clearSavedSessionFolder(ctx, setupInfo.booking._id).andThen(
			recreateSessionFolderStep(ctx, setupInfo, input)
		);
	};
}

function recreateSessionFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	input: Parameters<typeof getOrCreateSessionFolder>[2]
) {
	return () => getOrCreateSessionFolder(ctx, setupInfo, input);
}

function saveCreatedSessionFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	input: Parameters<typeof getOrCreateSessionFolder>[2]
) {
	return (folder: SavedDriveFolder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDriveSessionFolder, {
				bookingId: setupInfo.booking._id,
				driveClientId: input.driveClientId,
				folder
			})
		).map(mapSavedSessionFolderSetup(input.drive));
}

function mapSavedSessionFolderSetup(drive: DriveClient) {
	return (sessionFolderId: string) => ({ drive, sessionFolderId });
}

function getSessionFolderDisplayName(sessionStartAt: number, sessionFolderNumber: number) {
	return getPackageSessionFolderName(sessionFolderNumber, sessionStartAt);
}

function savedChildFolder(setupInfo: DriveSetupInfo, name: DriveChildFolderName) {
	switch (name) {
		case "Raw Media":
			return setupInfo.driveSession?.rawMediaFolder;
		case "Deliverables":
			return setupInfo.driveSession?.deliverablesFolder;
		default:
			return exhaustiveCheck(name);
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
		).orElse(
			recreateChildFolderAfterMissing(
				ctx,
				drive,
				setupInfo,
				sessionFolderId,
				name,
				replaceMissingFolders
			)
		);
	}

	return createFolderOrFindCreatedFolder(drive, {
		name: getSessionMediaFolderName(name, setupInfo.booking.sessionStartAt),
		parentId: sessionFolderId,
		marker: buildFolderMarker(setupInfo.booking._id, name.toLowerCase().replaceAll(" ", "_"))
	}).andThen(saveCreatedChildFolder(ctx, setupInfo, name));
}

function recreateChildFolderAfterMissing(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);

		if (setupInfo.driveSession !== null && name === "Raw Media") {
			setupInfo.driveSession.rawMediaFolder = undefined;
		}

		if (setupInfo.driveSession !== null && name === "Deliverables") {
			setupInfo.driveSession.deliverablesFolder = undefined;
		}

		return clearSavedChildFolder(ctx, setupInfo.booking._id, name).andThen(
			recreateChildFolderStep(ctx, drive, setupInfo, sessionFolderId, name, replaceMissingFolders)
		);
	};
}

function recreateChildFolderStep(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
) {
	return () =>
		getOrCreateChildFolder(ctx, drive, setupInfo, sessionFolderId, name, replaceMissingFolders);
}

function saveCreatedChildFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	name: DriveChildFolderName
) {
	return (folder: SavedDriveFolder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDriveChildFolder, {
				bookingId: setupInfo.booking._id,
				name,
				folder
			})
		).map(returnSavedChildFolder(folder));
}

function returnSavedChildFolder(folder: SavedDriveFolder) {
	return () => folder;
}

export function getOrCreateChildFolders(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	replaceMissingFolders: boolean
) {
	// Save each folder before creating the next so retries resume from the first unsaved folder.
	let sequence: ResultAsync<null, SetupError> = okAsync(null);

	for (const name of GOOGLE_DRIVE_CHILD_FOLDER_NAMES) {
		sequence = sequence.andThen(
			createChildFolderSequenceStep(
				ctx,
				drive,
				setupInfo,
				sessionFolderId,
				name,
				replaceMissingFolders
			)
		);
	}

	return sequence;
}

function createChildFolderSequenceStep(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
) {
	return () =>
		getOrCreateChildFolder(ctx, drive, setupInfo, sessionFolderId, name, replaceMissingFolders).map(
			returnNull
		);
}

// Package sessions must have their permanent number saved before any Drive call so retries
// keep it stable and concurrent setups of one package cannot allocate the same number.
export function allocateSessionFolderNumberIfNeeded(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo
): ResultAsync<number, SetupError> {
	if (setupInfo.packageRecord !== null) {
		return fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.allocatePackageSessionNumber, {
				bookingId: setupInfo.booking._id
			})
		);
	}

	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.allocateClientSessionNumber, {
			bookingId: setupInfo.booking._id
		})
	);
}

// Package sessions live inside their package folder; ordinary sessions sit directly below
// the client folder.
export function getOrCreateSessionParentFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { sessionParentId: string }, SetupError> {
	if (setupInfo.packageRecord === null) {
		return okAsync({ ...client, sessionParentId: client.clientFolderId });
	}

	const ownPackageFolder = setupInfo.driveSession?.packageFolder;

	if (ownPackageFolder !== undefined) {
		return verifyDriveFolder(client.drive, ownPackageFolder.id)
			.map(mapClientWithKnownSessionParentId(client, ownPackageFolder.id))
			.orElse(
				recreatePackageParentFolderAfterMissing(ctx, setupInfo, client, replaceMissingFolders)
			);
	}

	const packageFolderName = getPackageFolderName({
		packageSize: setupInfo.packageRecord.packageSize,
		purchasedAt: setupInfo.packageRecord.paidAt ?? setupInfo.packageRecord.createdAt
	});

	const sharedPackageFolder = setupInfo.sharedPackageFolder;

	// A sibling session already created the package folder; link it to this booking.
	if (sharedPackageFolder !== undefined) {
		return verifyDriveFolder(client.drive, sharedPackageFolder.id)
			.andThen(
				linkSharedPackageFolderToBooking(ctx, setupInfo, sharedPackageFolder, packageFolderName)
			)
			.map(mapClientWithSessionParentId(client))
			.orElse(
				recreateSharedPackageParentFolderAfterMissing(ctx, setupInfo, client, replaceMissingFolders)
			);
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: packageFolderName,
		parentId: client.clientFolderId,
		// The marker is derived from the package so every session of the package finds it.
		marker: `package:${setupInfo.packageRecord._id}`
	})
		.andThen(saveCreatedPackageFolder(ctx, setupInfo))
		.map(mapClientWithSessionParentId(client));
}

function mapClientWithSessionParentId(client: ClientFolderSetup) {
	return (sessionParentId: string) => ({ ...client, sessionParentId });
}

function mapClientWithKnownSessionParentId(client: ClientFolderSetup, sessionParentId: string) {
	return () => ({ ...client, sessionParentId });
}

function recreatePackageParentFolderAfterMissing(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);

		if (setupInfo.driveSession !== null) setupInfo.driveSession.packageFolder = undefined;

		return clearSavedPackageFolder(ctx, setupInfo.booking._id).andThen(
			recreateSessionParentFolderStep(ctx, setupInfo, client, replaceMissingFolders)
		);
	};
}

function recreateSessionParentFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	return () => getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders);
}

function linkSharedPackageFolderToBooking(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	sharedPackageFolder: NonNullable<DriveSetupInfo["sharedPackageFolder"]>,
	packageFolderName: string
) {
	return () =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDrivePackageFolder, {
				bookingId: setupInfo.booking._id,
				folder: {
					id: sharedPackageFolder.id,
					name: packageFolderName,
					webViewLink: sharedPackageFolder.url
				}
			})
		);
}

function recreateSharedPackageParentFolderAfterMissing(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
		setupInfo.sharedPackageFolder = undefined;

		return getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders);
	};
}

function saveCreatedPackageFolder(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
	return (folder: SavedDriveFolder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDrivePackageFolder, {
				bookingId: setupInfo.booking._id,
				folder
			})
		);
}
