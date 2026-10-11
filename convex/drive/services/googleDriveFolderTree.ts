"use node";

import { okAsync, ResultAsync } from "neverthrow";
import {
	driveTreeEmptyCheckPlan,
	driveChildDeletionTargets,
	selectRemainingDriveTreeChecks,
	selectDriveFolderTrees
} from "#convex/drive/lib/driveFolderTreeValidation";
import type { DriveClient, DriveError, ListedDriveChild } from "#convex/drive/lib/googleDrive";
import {
	deleteDriveItem,
	listDriveFolderChildren
} from "#convex/drive/services/googleDriveOperations";

function areListedDriveChildrenEmpty(
	drive: DriveClient,
	children: ListedDriveChild[]
): ResultAsync<boolean, DriveError> {
	const plan = driveTreeEmptyCheckPlan(children);

	return ResultAsync.combine(
		plan.folderIds.map((folderId) => isDriveFolderTreeEmpty(drive, folderId))
	)
		.map((results) => results[0] ?? plan.isEmpty)
		.andThen((childIsEmpty) =>
			ResultAsync.combine(
				selectRemainingDriveTreeChecks(plan.remainingLists, childIsEmpty).map((remaining) =>
					areListedDriveChildrenEmpty(drive, remaining)
				)
			).map((results) => results[0] ?? childIsEmpty)
		);
}

export function isDriveFolderTreeEmpty(
	drive: DriveClient,
	folderId: string
): ResultAsync<boolean, DriveError> {
	return listDriveFolderChildren(drive, folderId).andThen((children) =>
		areListedDriveChildrenEmpty(drive, children)
	);
}

function deleteDriveFolderTreeChildren(
	drive: DriveClient,
	folderId: string,
	children: ListedDriveChild[]
): ResultAsync<null, DriveError> {
	return children
		.reduce<ResultAsync<null, DriveError>>((previous, child) => {
			const targets = driveChildDeletionTargets(child);

			return previous.andThen(() =>
				ResultAsync.combine([
					...targets.folderIds.map((id) => deleteDriveFolderTree(drive, id)),
					...targets.fileIds.map((id) => deleteDriveItem(drive, id))
				]).map(() => null)
			);
		}, okAsync(null))
		.andThen(() => deleteDriveItem(drive, folderId));
}

export function deleteDriveFolderTree(
	drive: DriveClient,
	folderId: string
): ResultAsync<null, DriveError> {
	return listDriveFolderChildren(drive, folderId).andThen((children) =>
		deleteDriveFolderTreeChildren(drive, folderId, children)
	);
}

export function cleanDriveFolderTreeIfEmpty(
	drive: DriveClient | null,
	folderId: string | null
): ResultAsync<boolean, DriveError> {
	return ResultAsync.combine(
		selectDriveFolderTrees(drive, folderId, true).map((root) =>
			isDriveFolderTreeEmpty(root.drive, root.folderId).andThen((isEmpty) =>
				ResultAsync.combine(
					selectDriveFolderTrees(root.drive, root.folderId, isEmpty).map((emptyRoot) =>
						deleteDriveFolderTree(emptyRoot.drive, emptyRoot.folderId)
					)
				).map(() => isEmpty)
			)
		)
	).map((results) => results[0] ?? true);
}
