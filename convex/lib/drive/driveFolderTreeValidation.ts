"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type { DriveClient, DriveError, ListedDriveChild } from "#convex/lib/drive/googleDrive";

export function validateListedDriveFolderTreeEmpty(
	drive: DriveClient,
	areChildrenEmpty: (
		drive: DriveClient,
		children: ListedDriveChild[]
	) => ResultAsync<boolean, DriveError>
) {
	return (children: ListedDriveChild[]) =>
		children.length === 0 ? okAsync(true) : areChildrenEmpty(drive, children);
}
