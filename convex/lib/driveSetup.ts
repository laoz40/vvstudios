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
	getSessionFolderName,
	getSessionMediaFolderName,
	loadDriveClient,
	normalizeDriveEmail,
	verifyDriveFolder,
	GOOGLE_DRIVE_CHILD_FOLDER_NAMES,
	type DriveChildFolderName,
	type DriveClient,
	type DriveError,
	type SavedDriveFolder
} from "#convex/lib/googleDrive";

type SavedFolder = { id: string; url: string };

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
	driveClient: { _id: Id<"driveClients">; folderId: string; assetsFolder?: SavedFolder } | null;
	driveSession: {
		_id: Id<"driveSessions">;
		sessionFolder?: SavedFolder;
		rawMediaFolder?: SavedFolder;
		deliverablesFolder?: SavedFolder;
	} | null;
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
				| "PACKAGE_SESSION_NOT_SUPPORTED"
				| "DRIVE_FOLDERS_ALREADY_CREATED"
				| "GOOGLE_DRIVE_SAVE_FAILED";
	  };

const recordDriveSetupFailureByReason = {
	GOOGLE_DRIVE_AUTH_FAILED: true,
	GOOGLE_DRIVE_FOLDER_CREATE_FAILED: true,
	GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID: true,
	GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED: true,
	GOOGLE_DRIVE_FOLDER_MISSING: true,
	GOOGLE_DRIVE_PERMISSION_CREATE_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID: false,
	GOOGLE_DRIVE_SAVE_FAILED: true,
	DRIVE_RECORD_NOT_FOUND: true,
	NOT_AUTHENTICATED: false,
	NOT_AUTHORIZED: false,
	BOOKING_NOT_FOUND: false,
	BOOKING_NOT_ELIGIBLE: false,
	BOOKING_TIMING_CHANGED: false,
	PACKAGE_SESSION_NOT_SUPPORTED: false,
	DRIVE_FOLDERS_ALREADY_CREATED: false
} satisfies Record<SetupError["reason"], boolean>;

export function shouldRecordDriveSetupFailure(error: SetupError) {
	return recordDriveSetupFailureByReason[error.reason];
}

export function validateDriveSetup(
	setupInfo: DriveSetupInfo | null,
	expectedTiming?: { sessionStartAt: number; duration: string }
) {
	if (setupInfo === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
	if (setupInfo.booking.multiBookingPackageId !== undefined) {
		return err({ reason: "PACKAGE_SESSION_NOT_SUPPORTED" as const });
	}
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

function getOrCreateClientFolder(ctx: ActionCtx, setupInfo: DriveSetupInfo, drive: DriveClient) {
	if (setupInfo.driveClient !== null) {
		const savedClient = setupInfo.driveClient;
		return verifyDriveFolder(drive, savedClient.folderId).map(() => ({
			drive,
			clientFolderId: savedClient.folderId,
			driveClientId: savedClient._id,
			assetsFolder: savedClient.assetsFolder
		}));
	}

	const displayName = getClientFolderName({
		accountName: setupInfo.booking.accountName,
		contactName: setupInfo.booking.name
	});
	const normalizedEmail = normalizeDriveEmail(setupInfo.booking.email);
	return createFolderOrFindCreatedFolder(drive, {
		name: displayName,
		parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
		marker: `client:${normalizedEmail}`
	})
		.andThen((folder) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.saveDriveClientFolder, {
					normalizedEmail,
					displayName,
					folder
				})
			).mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
		)
		.map(({ assetsFolder, driveClientId, folderId }) => ({
			drive,
			clientFolderId: folderId,
			driveClientId,
			assetsFolder
		}));
}

type ClientFolderSetup = {
	drive: DriveClient;
	clientFolderId: string;
	driveClientId: Id<"driveClients">;
	assetsFolder?: SavedFolder;
};

function getOrCreateClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
): ResultAsync<ClientFolderSetup & { assetsFolder: SavedFolder }, SetupError> {
	const savedAssetsFolder = client.assetsFolder;
	if (savedAssetsFolder !== undefined) {
		return verifyDriveFolder(client.drive, savedAssetsFolder.id).map(() => ({
			...client,
			assetsFolder: savedAssetsFolder
		}));
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: "_Assets",
		parentId: client.clientFolderId,
		marker: `client:${normalizeDriveEmail(setupInfo.booking.email)}:assets`
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
	client: { drive: DriveClient; clientFolderId: string; driveClientId: Id<"driveClients"> }
) {
	const savedFolder = setupInfo.driveSession?.sessionFolder;
	if (savedFolder !== undefined) {
		return verifyDriveFolder(client.drive, savedFolder.id).map(() => ({
			drive: client.drive,
			sessionFolderId: savedFolder.id
		}));
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: getSessionFolderName(setupInfo.booking.sessionStartAt),
		parentId: client.clientFolderId,
		marker: buildFolderMarker(setupInfo.booking._id, "session")
	}).andThen((folder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessions.saveDriveSessionFolder, {
				bookingId: setupInfo.booking._id,
				driveClientId: client.driveClientId,
				folder
			})
		)
			.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			.map((sessionFolderId) => ({ drive: client.drive, sessionFolderId }))
	);
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
	name: DriveChildFolderName
): ResultAsync<SavedDriveFolder, SetupError> {
	const savedFolder = savedChildFolder(setupInfo, name);
	if (savedFolder !== undefined) return verifyDriveFolder(drive, savedFolder.id);

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
	sessionFolderId: string
) {
	// Save each folder before creating the next so retries resume from the first unsaved folder.
	let sequence: ResultAsync<null, SetupError> = okAsync(null);
	for (const name of GOOGLE_DRIVE_CHILD_FOLDER_NAMES) {
		sequence = sequence.andThen(() =>
			getOrCreateChildFolder(ctx, drive, setupInfo, sessionFolderId, name).map(() => null)
		);
	}
	return sequence;
}

export function createDriveFolders(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
	return loadDriveClient()
		.andThen((drive) => getOrCreateClientFolder(ctx, setupInfo, drive))
		.andThen((client) => getOrCreateClientAssetsFolder(ctx, setupInfo, client))
		.andThen((client) => getOrCreateSessionFolder(ctx, setupInfo, client))
		.andThen(({ drive, sessionFolderId }) =>
			getOrCreateChildFolders(ctx, drive, setupInfo, sessionFolderId)
		)
		.map(() => null);
}
