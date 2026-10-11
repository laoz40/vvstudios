"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type { RetiredAssetPermission } from "#convex/drive/lib/editorRetirement";
import {
	getEditorPermissionFolder,
	type EditorDriveAccessToRemove,
	type EditorDriveSetupRecord,
	type FailedEditorRemoval
} from "#convex/drive/lib/driveEditor";
import { loadDriveClient, type DriveClient, type DriveError } from "#convex/drive/lib/googleDrive";

export function loadDriveClientForRetirementAssets(
	assets: RetiredAssetPermission[]
): ResultAsync<DriveClient | null, DriveError> {
	if (assets.length === 0) return okAsync(null);

	return loadDriveClient();
}

export function loadEditorDriveClientForRemoval(
	access: EditorDriveAccessToRemove | FailedEditorRemoval | null
): ResultAsync<DriveClient | null, DriveError> {
	return access === null ? okAsync(null) : loadDriveClient();
}

export function loadEditorDriveClientForUnsavedPermission(
	fileId: string | null
): ResultAsync<DriveClient | null, DriveError> {
	return fileId === null ? okAsync(null) : loadDriveClient();
}

export function editorPermissionCleanupFolder(
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	error: { reason: string }
) {
	const permissionFolder = getEditorPermissionFolder(setup, name);

	return error.reason === "EDITOR_NOT_ACTIVE" ? (permissionFolder?.id ?? null) : null;
}
