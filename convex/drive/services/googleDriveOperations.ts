"use node";

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
	return createDriveFolderRequest(drive, input)
		.map((response) => response.data)
		.andThen(parseDriveFolderResponse);
}

export function findDriveFolderByMarker(
	drive: DriveClient,
	input: { marker: string; parentId: string } | null
) {
	return findDriveFolderByMarkerIfRequested(drive, input).andThen(parseDriveFolderListIfAvailable);
}

export function verifyDriveFolderIfPresent(drive: DriveClient, folderId: string | null) {
	return verifyDriveFolderRequestIfPresent(drive, folderId).andThen(
		parseDriveFolderResponseIfAvailable
	);
}

export function listDriveFolderChildren(drive: DriveClient, folderId: string) {
	return listDriveFolderChildrenRequest(drive, folderId)
		.map((response) => response.data.files)
		.andThen(parseDriveFolderChildrenResponse);
}

export function deleteDriveItem(drive: DriveClient, fileId: string) {
	return deleteDriveItemRequest(drive, fileId).orElse(ignoreMissingDriveFolder);
}

export function verifyDriveFolder(drive: DriveClient, folderId: string) {
	return verifyDriveFolderRequest(drive, folderId)
		.map((response) => response.data)
		.andThen(parseDriveFolderResponse);
}

export function renameDriveFolder(drive: DriveClient, input: { folderId: string; name: string }) {
	return renameDriveFolderRequest(drive, input)
		.map((response) => response.data)
		.andThen(parseDriveFolderResponse);
}

export function findDrivePermission(
	drive: DriveClient,
	input: { email: string; fileId: string; role: SavedDrivePermission["role"] }
) {
	return findDrivePermissionRequest(drive, input).andThen((response) =>
		parseDrivePermissionListForRemoval(response, input)
	);
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
	return createDrivePermissionRequest(drive, input)
		.map((response) => response.data)
		.andThen(parseDrivePermissionResponse);
}

export function findAnyonePermission(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return listDrivePermissionsRequest(drive, fileId)
		.map((response) => response.data.permissions)
		.andThen(parseDrivePermissionListResponse)
		.map((permissions) => findAnyoneDrivePermission(permissions, role));
}

export function createAnyonePermission(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return createDriveAnyonePermissionRequest(drive, fileId, role)
		.map((response) => response.data)
		.andThen(parseAnyonePermissionResponse);
}

export function deleteDrivePermission(
	drive: DriveClient,
	input: { fileId: string; permissionId: string }
) {
	return deleteDrivePermissionRequest(drive, input).orElse(ignoreMissingDrivePermission);
}
