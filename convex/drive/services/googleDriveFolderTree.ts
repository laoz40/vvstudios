"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { validateListedDriveFolderTreeEmpty } from "#convex/drive/lib/driveFolderTreeValidation";
import {
	deleteDriveItem,
	GOOGLE_DRIVE_FOLDER_MIME_TYPE,
	listDriveFolderChildren,
	type DriveClient,
	type DriveError,
	type ListedDriveChild
} from "#convex/drive/lib/googleDrive";

function continueEmptyTreeCheck(
	drive: DriveClient,
	remainingChildren: ListedDriveChild[],
	childIsEmpty: boolean
) {
	return childIsEmpty ? areListedDriveChildrenEmpty(drive, remainingChildren) : okAsync(false);
}

function checkListedChildEmptiness(
	drive: DriveClient,
	child: ListedDriveChild,
	remainingChildren: ListedDriveChild[]
) {
	return isDriveFolderTreeEmpty(drive, child.id).andThen((childIsEmpty: boolean) =>
		continueEmptyTreeCheck(drive, remainingChildren, childIsEmpty)
	);
}

function areListedDriveChildrenEmpty(
	drive: DriveClient,
	children: ListedDriveChild[]
): ResultAsync<boolean, DriveError> {
	if (children.length === 0) return okAsync(true);

	const child = children[0];

	if (child === undefined) return okAsync(true);

	const remainingChildren = children.slice(1);

	if (child.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) return okAsync(false);

	return checkListedChildEmptiness(drive, child, remainingChildren);
}

export function isDriveFolderTreeEmpty(drive: DriveClient, folderId: string) {
	return listDriveFolderChildren(drive, folderId).andThen((children) =>
		validateListedDriveFolderTreeEmpty(drive, areListedDriveChildrenEmpty, children)
	);
}

function deleteDriveChildFromTree(drive: DriveClient, child: ListedDriveChild) {
	return child.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
		? deleteDriveFolderTree(drive, child.id)
		: deleteDriveItem(drive, child.id);
}

function deleteDriveFolderTreeChildren(
	drive: DriveClient,
	folderId: string,
	children: ListedDriveChild[]
) {
	let chain: ResultAsync<null, DriveError> = okAsync(null);

	for (const child of children) {
		chain = chain.andThen(() => deleteDriveChildStep(drive, child));
	}

	return chain.andThen(() => deleteDriveFolderAfterChildren(drive, folderId));
}

function deleteDriveChildStep(drive: DriveClient, child: ListedDriveChild) {
	return deleteDriveChildFromTree(drive, child);
}

function deleteDriveFolderAfterChildren(drive: DriveClient, folderId: string) {
	return deleteDriveItem(drive, folderId);
}

export function deleteDriveFolderTree(drive: DriveClient, folderId: string) {
	return listDriveFolderChildren(drive, folderId).andThen((children: ListedDriveChild[]) =>
		deleteDriveFolderTreeChildren(drive, folderId, children)
	);
}
