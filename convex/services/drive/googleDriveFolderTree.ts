"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { validateListedDriveFolderTreeEmpty } from "#convex/lib/drive/driveFolderTreeValidation";
import {
	deleteDriveItem,
	GOOGLE_DRIVE_FOLDER_MIME_TYPE,
	listDriveFolderChildren,
	type DriveClient,
	type DriveError,
	type ListedDriveChild
} from "#convex/lib/drive/googleDrive";

function continueEmptyTreeCheck(drive: DriveClient, remainingChildren: ListedDriveChild[]) {
	return (childIsEmpty: boolean) =>
		childIsEmpty ? areListedDriveChildrenEmpty(drive, remainingChildren) : okAsync(false);
}

function checkListedChildEmptiness(
	drive: DriveClient,
	child: ListedDriveChild,
	remainingChildren: ListedDriveChild[]
) {
	return isDriveFolderTreeEmpty(drive, child.id).andThen(
		continueEmptyTreeCheck(drive, remainingChildren)
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
	return listDriveFolderChildren(drive, folderId).andThen(
		validateListedDriveFolderTreeEmpty(drive, areListedDriveChildrenEmpty)
	);
}

function deleteDriveChildFromTree(drive: DriveClient, child: ListedDriveChild) {
	return child.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
		? deleteDriveFolderTree(drive, child.id)
		: deleteDriveItem(drive, child.id);
}

function deleteDriveFolderTreeChildren(drive: DriveClient, folderId: string) {
	return (children: ListedDriveChild[]) => {
		let chain: ResultAsync<null, DriveError> = okAsync(null);

		for (const child of children) {
			chain = chain.andThen(deleteDriveChildStep(drive, child));
		}

		return chain.andThen(deleteDriveFolderAfterChildren(drive, folderId));
	};
}

function deleteDriveChildStep(drive: DriveClient, child: ListedDriveChild) {
	return () => deleteDriveChildFromTree(drive, child);
}

function deleteDriveFolderAfterChildren(drive: DriveClient, folderId: string) {
	return () => deleteDriveItem(drive, folderId);
}

export function deleteDriveFolderTree(drive: DriveClient, folderId: string) {
	return listDriveFolderChildren(drive, folderId).andThen(
		deleteDriveFolderTreeChildren(drive, folderId)
	);
}
