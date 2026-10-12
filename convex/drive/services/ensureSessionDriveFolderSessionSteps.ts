"use node";

import { ok, safeTry } from "neverthrow";
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
	type DriveClient
} from "#convex/drive/lib/googleDrive";
import { verifyDriveFolderIfPresent } from "#convex/drive/services/googleDriveOperations";
import { requireSavedDriveFolder } from "#convex/drive/lib/folderSetupDecisions";
import {
	createFolderOrFindCreatedFolder,
	verifyAndRenameDriveFolder,
	type ClientFolderSetup
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
) {
	const requests = selectSessionFolderRequests(setupInfo, input);

	return safeTry(async function* () {
		const verifiedFolder = yield* verifyAndRenameDriveFolder(
			input.drive,
			requests.verification
		).orElse((error) =>
			resetMissingSessionFolder(ctx, setupInfo, input.replaceMissingFolders, error)
		);

		const createdFolder = yield* createFolderOrFindCreatedFolder(
			input.drive,
			selectSessionFolderRequests(setupInfo, input).creation
		);

		const folder = yield* requireSavedDriveFolder(verifiedFolder ?? createdFolder);

		const sessionFolderId = yield* saveDriveSessionFolderRow(
			ctx,
			sessionFolderSaveArgs(setupInfo, input, folder)
		);

		return ok({ drive: input.drive, sessionFolderId: sessionFolderId ?? folder.id });
	});
}

function resetMissingSessionFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,
	error: SetupError
) {
	return safeTry(async function* () {
		yield* shouldReplaceMissingDriveFolder(error, replaceMissingFolders);
		yield* clearDriveSessionFolderRow(ctx, { bookingId: setupInfo.booking._id });
		clearSessionFolderState(setupInfo);

		return ok(null);
	});
}

function getOrCreateChildFolder(
	ctx: ActionCtx,
	drive: DriveClient,
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean
) {
	const requests = selectChildFolderRequests(setupInfo, sessionFolderId, name);

	return safeTry(async function* () {
		const verifiedFolder = yield* verifyAndRenameDriveFolder(drive, requests.verification).orElse(
			(error) => resetMissingChildFolder(ctx, setupInfo, name, replaceMissingFolders, error)
		);

		const createdFolder = yield* createFolderOrFindCreatedFolder(
			drive,
			selectChildFolderRequests(setupInfo, sessionFolderId, name).creation
		);

		const folder = yield* requireSavedDriveFolder(verifiedFolder ?? createdFolder);
		yield* saveDriveChildFolderRow(
			ctx,
			childFolderSaveArgs(
				selectChildFolderRequests(setupInfo, sessionFolderId, name).saveBookingId,
				name,
				folder
			)
		);

		return ok(folder);
	});
}

function resetMissingChildFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	name: DriveChildFolderName,
	replaceMissingFolders: boolean,
	error: SetupError
) {
	return safeTry(async function* () {
		yield* shouldReplaceMissingDriveFolder(error, replaceMissingFolders);
		yield* clearDriveChildFolderRow(ctx, { bookingId: setupInfo.booking._id, name });
		clearChildFolderState(setupInfo, name);

		return ok(null);
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
	return safeTry(async function* () {
		for (const name of GOOGLE_DRIVE_CHILD_FOLDER_NAMES) {
			yield* getOrCreateChildFolder(
				ctx,
				drive,
				setupInfo,
				sessionFolderId,
				name,
				replaceMissingFolders
			);
		}

		return ok(null);
	});
}

// Package sessions must have their permanent number saved before any Drive call so retries
// keep it stable and concurrent setups of one package cannot allocate the same number.
export function allocateSessionFolderNumberIfNeeded(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
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
) {
	const requests = selectSessionParentRequests(setupInfo, client);

	return safeTry(async function* () {
		const verifiedFolder = yield* verifyDriveFolderIfPresent(
			client.drive,
			requests.verificationFolderId
		).orElse((error) =>
			resetMissingSessionParentFolder(ctx, setupInfo, requests, replaceMissingFolders, error)
		);

		const createdFolder = yield* createFolderOrFindCreatedFolder(
			client.drive,
			selectSessionParentRequests(setupInfo, client).creation
		);

		const resolved = yield* resolveSessionParentFolder(
			selectSessionParentRequests(setupInfo, client).directParentId,
			verifiedFolder ?? createdFolder
		);

		yield* saveDrivePackageFolderRow(
			ctx,
			packageFolderSaveArgs(selectSessionParentRequests(setupInfo, client), resolved.packageFolder)
		);

		return ok({ ...client, sessionParentId: resolved.sessionParentId });
	});
}

function resetMissingSessionParentFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	requests: ReturnType<typeof selectSessionParentRequests>,
	replaceMissingFolders: boolean,
	error: SetupError
) {
	return safeTry(async function* () {
		yield* shouldReplaceMissingDriveFolder(error, replaceMissingFolders);
		yield* clearDrivePackageFolderRow(
			ctx,
			requests.clearPackageFolderBookingId === null
				? null
				: { bookingId: requests.clearPackageFolderBookingId }
		);
		clearMissingSessionParentFolderState(setupInfo, requests.recoveryKind);

		return ok(null);
	});
}
