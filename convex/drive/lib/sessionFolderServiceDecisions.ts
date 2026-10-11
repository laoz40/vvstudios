"use node";

import { err, ok, type Result } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/drive/lib/googleDrive";
import {
	getPackageFolderName,
	getPackageSessionFolderName,
	getSessionMediaFolderName
} from "#convex/drive/lib/googleDrive";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { requireSavedDriveFolder } from "#convex/drive/lib/folderSetupDecisions";

type SessionFolderInput = {
	driveClientId: Id<"driveClients">;
	sessionParentId: string;
	sessionFolderNumber: number;
};

type DriveFolderCreateInput = { name: string; parentId: string; marker: string };

export function clearSessionFolderState(setupInfo: DriveSetupInfo) {
	if (setupInfo.driveSession !== null) {
		setupInfo.driveSession.sessionFolder = undefined;
		setupInfo.driveSession.rawMediaFolder = undefined;
		setupInfo.driveSession.deliverablesFolder = undefined;
	}

	return setupInfo;
}

export function clearChildFolderState(setupInfo: DriveSetupInfo, name: DriveChildFolderName) {
	if (setupInfo.driveSession !== null) {
		if (name === "Raw Media") setupInfo.driveSession.rawMediaFolder = undefined;

		if (name === "Deliverables") setupInfo.driveSession.deliverablesFolder = undefined;
	}

	return setupInfo;
}

export function clearPackageFolderState(setupInfo: DriveSetupInfo) {
	if (setupInfo.driveSession !== null) setupInfo.driveSession.packageFolder = undefined;

	return setupInfo;
}

export function clearSharedPackageFolderState(setupInfo: DriveSetupInfo) {
	setupInfo.sharedPackageFolder = undefined;

	return setupInfo;
}

export function shouldReplaceMissingDriveFolder(
	error: SetupError,
	replaceMissingFolders: boolean
): Result<null, SetupError> {
	return replaceMissingFolders && error.reason === "GOOGLE_DRIVE_FOLDER_MISSING"
		? ok(null)
		: err(error);
}

export function selectSessionFolderRequests(setupInfo: DriveSetupInfo, input: SessionFolderInput) {
	const savedFolder = setupInfo.driveSession?.sessionFolder;

	return {
		verification:
			savedFolder === undefined
				? null
				: {
						folderId: savedFolder.id,
						expectedName: getPackageSessionFolderName(
							input.sessionFolderNumber,
							setupInfo.booking.sessionStartAt
						)
					},
		creation:
			savedFolder !== undefined
				? null
				: {
						name: getPackageSessionFolderName(
							input.sessionFolderNumber,
							setupInfo.booking.sessionStartAt
						),
						parentId: input.sessionParentId,
						marker: `${setupInfo.booking._id}:session`
					},
		saveBookingId: savedFolder === undefined ? setupInfo.booking._id : null,
		driveClientId: input.driveClientId
	};
}

export function sessionFolderSaveArgs(
	setupInfo: DriveSetupInfo,
	input: SessionFolderInput,
	folder: SavedDriveFolder
) {
	return setupInfo.driveSession?.sessionFolder !== undefined
		? null
		: { bookingId: setupInfo.booking._id, driveClientId: input.driveClientId, folder };
}

export function selectChildFolderRequests(
	setupInfo: DriveSetupInfo,
	sessionFolderId: string,
	name: DriveChildFolderName
) {
	const savedFolder =
		name === "Raw Media"
			? setupInfo.driveSession?.rawMediaFolder
			: setupInfo.driveSession?.deliverablesFolder;

	return {
		verification:
			savedFolder === undefined
				? null
				: {
						folderId: savedFolder.id,
						expectedName: getSessionMediaFolderName(name, setupInfo.booking.sessionStartAt)
					},
		creation:
			savedFolder !== undefined
				? null
				: {
						name: getSessionMediaFolderName(name, setupInfo.booking.sessionStartAt),
						parentId: sessionFolderId,
						marker: `${setupInfo.booking._id}:${name.toLowerCase().replaceAll(" ", "_")}`
					},
		saveBookingId: savedFolder === undefined ? setupInfo.booking._id : null
	};
}

export function childFolderSaveArgs(
	bookingId: Id<"bookings"> | null,
	name: DriveChildFolderName,
	folder: SavedDriveFolder
) {
	return bookingId === null ? null : { bookingId, name, folder };
}

type SessionParentRequests = {
	directParentId: string | null;
	verificationFolderId: string | null;
	creation: DriveFolderCreateInput | null;
	recoveryKind: "package" | "shared" | null;
	clearPackageFolderBookingId: Id<"bookings"> | null;
	sharedFolderSave: { bookingId: Id<"bookings">; folder: SavedDriveFolder } | null;
	saveCreatedFolderBookingId: Id<"bookings"> | null;
};

export function selectSessionParentRequests(
	setupInfo: DriveSetupInfo,
	client: { clientFolderId: string }
): SessionParentRequests {
	const packageRecord = setupInfo.packageRecord;

	if (packageRecord === null) {
		return {
			directParentId: client.clientFolderId,
			verificationFolderId: null,
			creation: null,
			recoveryKind: null,
			clearPackageFolderBookingId: null,
			sharedFolderSave: null,
			saveCreatedFolderBookingId: null
		};
	}

	const packageFolderName = getPackageFolderName({
		packageSize: packageRecord.packageSize,
		purchasedAt: packageRecord.paidAt ?? packageRecord.createdAt
	});

	const savedPackageFolder = setupInfo.driveSession?.packageFolder;

	if (savedPackageFolder !== undefined) {
		return {
			directParentId: null,
			verificationFolderId: savedPackageFolder.id,
			creation: null,
			recoveryKind: "package",
			clearPackageFolderBookingId: setupInfo.booking._id,
			sharedFolderSave: null,
			saveCreatedFolderBookingId: null
		};
	}

	const sharedPackageFolder = setupInfo.sharedPackageFolder;

	if (sharedPackageFolder !== undefined) {
		return {
			directParentId: null,
			verificationFolderId: sharedPackageFolder.id,
			creation: null,
			recoveryKind: "shared",
			clearPackageFolderBookingId: null,
			sharedFolderSave: {
				bookingId: setupInfo.booking._id,
				folder: {
					id: sharedPackageFolder.id,
					name: packageFolderName,
					webViewLink: sharedPackageFolder.url
				}
			},
			saveCreatedFolderBookingId: null
		};
	}

	return {
		directParentId: null,
		verificationFolderId: null,
		creation: {
			name: packageFolderName,
			parentId: client.clientFolderId,
			marker: `package:${packageRecord._id}`
		},
		recoveryKind: null,
		clearPackageFolderBookingId: null,
		sharedFolderSave: null,
		saveCreatedFolderBookingId: setupInfo.booking._id
	};
}

export function resolveSessionParentFolder(
	directParentId: string | null,
	folder: SavedDriveFolder | null
): Result<{ sessionParentId: string; packageFolder: SavedDriveFolder | null }, SetupError> {
	return directParentId === null
		? requireSavedDriveFolder(folder).map((savedFolder) => ({
				sessionParentId: savedFolder.id,
				packageFolder: savedFolder
			}))
		: ok({ sessionParentId: directParentId, packageFolder: null });
}

export function clearMissingSessionParentFolderState(
	setupInfo: DriveSetupInfo,
	recoveryKind: SessionParentRequests["recoveryKind"]
) {
	if (recoveryKind === "package") return clearPackageFolderState(setupInfo);

	if (recoveryKind === "shared") return clearSharedPackageFolderState(setupInfo);

	return setupInfo;
}

export function packageFolderSaveArgs(
	requests: SessionParentRequests,
	folder: SavedDriveFolder | null
) {
	return (
		requests.sharedFolderSave ??
		(requests.saveCreatedFolderBookingId === null || folder === null
			? null
			: { bookingId: requests.saveCreatedFolderBookingId, folder })
	);
}
