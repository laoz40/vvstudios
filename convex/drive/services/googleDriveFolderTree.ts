"use node";

import { ok, ResultAsync, safeTry } from "neverthrow";
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

	return safeTry(async function* () {
		const childResults = yield* ResultAsync.combine(
			plan.folderIds.map((folderId) => isDriveFolderTreeEmpty(drive, folderId))
		);

		const childIsEmpty = childResults[0] ?? plan.isEmpty;

		const remainingResults = yield* ResultAsync.combine(
			selectRemainingDriveTreeChecks(plan.remainingLists, childIsEmpty).map((remaining) =>
				areListedDriveChildrenEmpty(drive, remaining)
			)
		);

		return ok(remainingResults[0] ?? childIsEmpty);
	});
}

export function isDriveFolderTreeEmpty(drive: DriveClient, folderId: string) {
	return safeTry(async function* () {
		const children = yield* listDriveFolderChildren(drive, folderId);

		return ok(yield* areListedDriveChildrenEmpty(drive, children));
	});
}

function deleteDriveFolderTreeChildren(
	drive: DriveClient,
	folderId: string,
	children: ListedDriveChild[]
): ResultAsync<null, DriveError> {
	return safeTry(async function* () {
		for (const child of children) {
			const targets = driveChildDeletionTargets(child);

			yield* ResultAsync.combine([
				...targets.folderIds.map((id) => deleteDriveFolderTree(drive, id)),
				...targets.fileIds.map((id) => deleteDriveItem(drive, id))
			]);
		}

		return ok(yield* deleteDriveItem(drive, folderId));
	});
}

export function deleteDriveFolderTree(drive: DriveClient, folderId: string) {
	return safeTry(async function* () {
		const children = yield* listDriveFolderChildren(drive, folderId);

		return ok(yield* deleteDriveFolderTreeChildren(drive, folderId, children));
	});
}

export function cleanDriveFolderTreeIfEmpty(drive: DriveClient | null, folderId: string | null) {
	return safeTry(async function* () {
		const results = yield* ResultAsync.combine(
			selectDriveFolderTrees(drive, folderId, true).map((root) =>
				safeTry(async function* () {
					const isEmpty = yield* isDriveFolderTreeEmpty(root.drive, root.folderId);
					yield* ResultAsync.combine(
						selectDriveFolderTrees(root.drive, root.folderId, isEmpty).map((emptyRoot) =>
							deleteDriveFolderTree(emptyRoot.drive, emptyRoot.folderId)
						)
					);

					return ok(isEmpty);
				})
			)
		);

		return ok(results[0] ?? true);
	});
}
