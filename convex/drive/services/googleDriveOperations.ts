"use node";

import { ok, safeTry } from "neverthrow";

import {
	createDriveAnyonePermissionRequest,
	createDriveFolderRequest,
	createDrivePermissionRequest,
	deleteDriveItemRequest,
	deleteDrivePermissionRequest,
	findDriveFolderByMarkerIfRequested,
	findDrivePermissionRequest,
	findAnyoneDrivePermission,
	ignoreMissingDriveFolder,
	ignoreMissingDrivePermission,
	listDriveFolderChildrenRequest,
	listDrivePermissionsRequest,
	parseAnyonePermissionResponse,
	parseDriveFolderChildrenResponse,
	parseDriveFolderResponse,
	parseDriveFolderListIfAvailable,
	parseDriveFolderResponseIfAvailable,
	parseDrivePermissionListResponse,
	parseDrivePermissionListForRemoval,
	parseDrivePermissionResponse,
	renameDriveFolderRequest,
	verifyDriveFolderRequest,
	verifyDriveFolderIfPresent as verifyDriveFolderRequestIfPresent,
	type DriveClient,
	type SavedDrivePermission
} from "#convex/drive/lib/googleDrive";

export function createDriveFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return safeTry(async function* () {
		const response = yield* createDriveFolderRequest(drive, input);
		const folder = yield* parseDriveFolderResponse(response.data);

		return ok(folder);
	});
}

export function findDriveFolderByMarker(
	drive: DriveClient,
	input: { marker: string; parentId: string } | null
) {
	return safeTry(async function* () {
		const response = yield* findDriveFolderByMarkerIfRequested(drive, input);
		const folder = yield* parseDriveFolderListIfAvailable(response);

		return ok(folder);
	});
}

export function verifyDriveFolderIfPresent(drive: DriveClient, folderId: string | null) {
	return safeTry(async function* () {
		const response = yield* verifyDriveFolderRequestIfPresent(drive, folderId);
		const folder = yield* parseDriveFolderResponseIfAvailable(response);

		return ok(folder);
	});
}

export function listDriveFolderChildren(drive: DriveClient, folderId: string) {
	return safeTry(async function* () {
		const response = yield* listDriveFolderChildrenRequest(drive, folderId);
		const children = yield* parseDriveFolderChildrenResponse(response.data.files);

		return ok(children);
	});
}

export function deleteDriveItem(drive: DriveClient, fileId: string) {
	return deleteDriveItemRequest(drive, fileId).orElse(ignoreMissingDriveFolder);
}

export function verifyDriveFolder(drive: DriveClient, folderId: string) {
	return safeTry(async function* () {
		const response = yield* verifyDriveFolderRequest(drive, folderId);
		const folder = yield* parseDriveFolderResponse(response.data);

		return ok(folder);
	});
}

export function renameDriveFolder(drive: DriveClient, input: { folderId: string; name: string }) {
	return safeTry(async function* () {
		const response = yield* renameDriveFolderRequest(drive, input);
		const folder = yield* parseDriveFolderResponse(response.data);

		return ok(folder);
	});
}

export function findDrivePermission(
	drive: DriveClient,
	input: { email: string; fileId: string; role: SavedDrivePermission["role"] }
) {
	return safeTry(async function* () {
		const response = yield* findDrivePermissionRequest(drive, input);
		const permission = yield* parseDrivePermissionListForRemoval(response, input);

		return ok(permission);
	});
}

export function createDrivePermission(
	drive: DriveClient,
	input: {
		email: string;
		fileId: string;
		role: SavedDrivePermission["role"];
		sendNotificationEmail: boolean;
	}
) {
	return safeTry(async function* () {
		const response = yield* createDrivePermissionRequest(drive, input);
		const permission = yield* parseDrivePermissionResponse(response.data);

		return ok(permission);
	});
}

export function findAnyonePermission(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return safeTry(async function* () {
		const response = yield* listDrivePermissionsRequest(drive, fileId);
		const permissions = yield* parseDrivePermissionListResponse(response.data.permissions);

		return ok(findAnyoneDrivePermission(permissions, role));
	});
}

export function createAnyonePermission(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return safeTry(async function* () {
		const response = yield* createDriveAnyonePermissionRequest(drive, fileId, role);
		const permission = yield* parseAnyonePermissionResponse(response.data);

		return ok(permission);
	});
}

export function deleteDrivePermission(
	drive: DriveClient,
	input: { fileId: string; permissionId: string }
) {
	return deleteDrivePermissionRequest(drive, input).orElse(ignoreMissingDrivePermission);
}
