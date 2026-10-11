"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import {
	allocateSessionFolderNumberRow,
	clearDriveChildFolderRow,
	clearDrivePackageFolderRow,
	clearDriveSessionFolderRow,
	saveDriveChildFolderRow,
	saveDrivePackageFolderRow,
	saveDriveSessionFolderRow
} from "#convex/drive/lib/driveFolderMutations";
import {
	clearChildFolderState,
	clearSessionFolderState,
	clearMissingSessionParentFolderState,
	childFolderSaveArgs,
	packageFolderSaveArgs,
	resolveSessionParentFolder,
	selectChildFolderRequests,
	selectSessionFolderRequests,
	selectSessionParentRequests,
	sessionFolderSaveArgs,
	shouldReplaceMissingDriveFolder
} from "#convex/drive/lib/sessionFolderServiceDecisions";
import {
	GOOGLE_DRIVE_CHILD_FOLDER_NAMES,
	type DriveChildFolderName,
	type DriveClient,
	type SavedDriveFolder
} from "#convex/drive/lib/googleDrive";
import { verifyDriveFolderIfPresent } from "#convex/drive/services/googleDriveOperations";
import { requireSavedDriveFolder } from "#convex/drive/lib/folderSetupDecisions";
import {
	createFolderOrFindCreatedFolder,
	verifyAndRenameDriveFolder,
	type ClientFolderSetup,
	type SessionFolderSetup
} from "#convex/drive/services/ensureSessionDriveFolderHelpers";

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
	const requests = selectSessionFolderRequests(setupInfo, input);

	return verifyAndRenameDriveFolder(input.drive, requests.verification)
		.orElse((error) =>
			shouldReplaceMissingDriveFolder(error, input.replaceMissingFolders).asyncAndThen(() =>
				clearSessionFolderRow(ctx, setupInfo)
			)
		)
		.andThen((verifiedFolder) =>
			createFolderOrFindCreatedFolder(
				input.drive,
				selectSessionFolderRequests(setupInfo, input).creation
			)
				.andThen((createdFolder) => requireSavedDriveFolder(verifiedFolder ?? createdFolder))
				.andThen((folder) =>
					saveDriveSessionFolderRow(ctx, sessionFolderSaveArgs(setupInfo, input, folder)).map(
						(sessionFolderId) => ({
							drive: input.drive,
							sessionFolderId: sessionFolderId ?? folder.id
						})
					)
				)
		);
}

function clearSessionFolderRow(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
	return clearDriveSessionFolderRow(ctx, { bookingId: setupInfo.booking._id }).map(() => {
		clearSessionFolderState(setupInfo);

		return null;
	});
}

function getOrCreateChildFolder(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
): ResultAsync<SavedDriveFolder, SetupError> {
	const requests = selectChildFolderRequests(setupInfo, sessionFolderId, name);

	return verifyAndRenameDriveFolder(drive, requests.verification)
		.orElse((error) =>
			shouldReplaceMissingDriveFolder(error, replaceMissingFolders).asyncAndThen(() =>
				clearChildFolderRow(ctx, setupInfo, name)
			)
		)
		.andThen((verifiedFolder) =>
			createFolderOrFindCreatedFolder(
				drive,
				selectChildFolderRequests(setupInfo, sessionFolderId, name).creation
			)
				.andThen((createdFolder) => requireSavedDriveFolder(verifiedFolder ?? createdFolder))
				.andThen((folder) =>
					saveDriveChildFolderRow(
						ctx,
						childFolderSaveArgs(
							selectChildFolderRequests(setupInfo, sessionFolderId, name).saveBookingId,
							name,
							folder
						)
					).map(() => folder)
				)
		);
}

function clearChildFolderRow(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	name: DriveChildFolderName
) {
	return clearDriveChildFolderRow(ctx, { bookingId: setupInfo.booking._id, name }).map(() => {
		clearChildFolderState(setupInfo, name);

		return null;
	});
}

export function getOrCreateChildFolders(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	replaceMissingFolders: boolean
) {
	// Save each folder before creating the next so retries resume from the first unsaved folder.
	return GOOGLE_DRIVE_CHILD_FOLDER_NAMES.reduce(
		(sequence, name) =>
			sequence.andThen(() =>
				getOrCreateChildFolder(
					ctx,
					drive,
					setupInfo,
					sessionFolderId,
					name,
					replaceMissingFolders
				).map(() => null)
			),
		okAsync<null, SetupError>(null)
	);
}

// Package sessions must have their permanent number saved before any Drive call so retries
// keep it stable and concurrent setups of one package cannot allocate the same number.
export function allocateSessionFolderNumberIfNeeded(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo
): ResultAsync<number, SetupError> {
	return allocateSessionFolderNumberRow(ctx, {
		bookingId: setupInfo.booking._id,
		packageBooking: setupInfo.packageRecord !== null
	});
}

// Package sessions live inside their package folder; ordinary sessions sit directly below
// the client folder.
export function getOrCreateSessionParentFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { sessionParentId: string }, SetupError> {
	const requests = selectSessionParentRequests(setupInfo, client);

	return verifyDriveFolderIfPresent(client.drive, requests.verificationFolderId)
		.orElse((error) =>
			shouldReplaceMissingDriveFolder(error, replaceMissingFolders).asyncAndThen(() =>
				clearSessionParentFolderRow(ctx, setupInfo, requests)
			)
		)
		.andThen((verifiedFolder) =>
			createFolderOrFindCreatedFolder(
				client.drive,
				selectSessionParentRequests(setupInfo, client).creation
			).andThen((createdFolder) =>
				resolveSessionParentFolder(
					selectSessionParentRequests(setupInfo, client).directParentId,
					verifiedFolder ?? createdFolder
				).asyncAndThen((resolved) =>
					saveDrivePackageFolderRow(
						ctx,
						packageFolderSaveArgs(
							selectSessionParentRequests(setupInfo, client),
							resolved.packageFolder
						)
					).map(() => ({ ...client, sessionParentId: resolved.sessionParentId }))
				)
			)
		);
}

function clearSessionParentFolderRow(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	requests: ReturnType<typeof selectSessionParentRequests>
) {
	return clearDrivePackageFolderRow(
		ctx,
		requests.clearPackageFolderBookingId === null
			? null
			: { bookingId: requests.clearPackageFolderBookingId }
	).map(() => {
		clearMissingSessionParentFolderState(setupInfo, requests.recoveryKind);

		return null;
	});
}
