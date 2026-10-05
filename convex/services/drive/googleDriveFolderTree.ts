"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import {
	deleteDriveItem,
	GOOGLE_DRIVE_FOLDER_MIME_TYPE,
	listDriveFolderChildren,
	type DriveClient,
	type DriveError,
	type ListedDriveChild
} from "#convex/lib/drive/googleDrive";

function areListedDriveChildrenEmpty(
	drive: DriveClient,
	children: ListedDriveChild[]
): ResultAsync<boolean, DriveError> {
	if (children.length === 0) return okAsync(true);

	const child = children[0];

	if (child === undefined) return okAsync(true);

	const remainingChildren = children.slice(1);

	if (child.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) return okAsync(false);

	return isDriveFolderTreeEmpty(drive, child.id).andThen((childIsEmpty) =>
		childIsEmpty ? areListedDriveChildrenEmpty(drive, remainingChildren) : okAsync(false)
	);
}

export function isDriveFolderTreeEmpty(drive: DriveClient, folderId: string) {
	return listDriveFolderChildren(drive, folderId).andThen((children) =>
		children.length === 0 ? okAsync(true) : areListedDriveChildrenEmpty(drive, children)
	);
}

export function deleteDriveFolderTree(drive: DriveClient, folderId: string) {
	return listDriveFolderChildren(drive, folderId).andThen((children) => {
		let chain: ResultAsync<null, DriveError> = okAsync(null);

		for (const child of children) {
			chain = chain.andThen(() =>
				child.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
					? deleteDriveFolderTree(drive, child.id)
					: deleteDriveItem(drive, child.id)
			);
		}

		return chain.andThen(() => deleteDriveItem(drive, folderId));
	});
}
