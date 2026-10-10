"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type { DriveClient, DriveError, ListedDriveChild } from "#convex/drive/lib/googleDrive";

export function validateListedDriveFolderTreeEmpty(
	drive: DriveClient,
	areChildrenEmpty: (
		drive: DriveClient,
		children: ListedDriveChild[]
	) => ResultAsync<boolean, DriveError>,
	children: ListedDriveChild[]
) {
	return children.length === 0 ? okAsync(true) : areChildrenEmpty(drive, children);
}
