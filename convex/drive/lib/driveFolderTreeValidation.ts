import type { DriveClient, ListedDriveChild } from "#convex/drive/lib/googleDrive";

export function isListedDriveFolder(child: ListedDriveChild) {
	return child.mimeType === "application/vnd.google-apps.folder";
}

export function driveTreeEmptyCheckPlan(children: ListedDriveChild[]) {
	const [child, ...remaining] = children;
	const isFolder = child !== undefined && isListedDriveFolder(child);

	return {
		folderIds: isFolder ? [child.id] : [],
		remainingLists: isFolder ? [remaining] : [],
		isEmpty: child === undefined || isFolder
	};
}

export function selectRemainingDriveTreeChecks(
	remaining: ListedDriveChild[][],
	childIsEmpty: boolean
) {
	return childIsEmpty ? remaining : [];
}

export function driveChildDeletionTargets(child: ListedDriveChild) {
	const isFolder = isListedDriveFolder(child);

	return { folderIds: isFolder ? [child.id] : [], fileIds: isFolder ? [] : [child.id] };
}

export function selectDriveFolderTrees(
	drive: DriveClient | null,
	folderId: string | null,
	eligible: boolean
) {
	return drive === null || folderId === null || !eligible ? [] : [{ drive, folderId }];
}
