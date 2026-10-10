"use node";

import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	deleteDrivePermission,
	loadDriveClient,
	type DriveClient,
	type DriveError
} from "#convex/drive/lib/googleDrive";
import { fromConvexTuple } from "#convex/shared/lib/result";
import {
	loadEditorDriveAccessToRemove,
	markPreviousEditorRemovalFailed,
	removePreviousEditorDriveAccess,
	type DriveEditorPermissionsError
} from "#convex/drive/services/editorDrivePermissions";
import { retryFailedPreviousEditorRemoval } from "#convex/drive/services/driveEditorPermissions";

type RetiredAssetPermission = {
	assetsFolderId: string | null;
	bookingId: Doc<"bookings">["_id"] | null;
	permission: Doc<"driveClientEditorPermissions">;
};

type EditorRetirementError = DriveEditorPermissionsError | DriveError;

function loadEditorRetirementSessions(ctx: ActionCtx, editorTokenIdentifier: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.driveInternal.getEditorRetirementSessions, { editorTokenIdentifier })
	);
}

function loadEditorRetirementAssets(ctx: ActionCtx, editorTokenIdentifier: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.driveInternal.getEditorRetirementAssets, { editorTokenIdentifier })
	);
}

function clearRetiredAssetPermission(
	ctx: ActionCtx,
	permission: Doc<"driveClientEditorPermissions">,
	editorTokenIdentifier: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.driveInternal.clearEditorAssetPermission, {
			permissionId: permission._id,
			editorTokenIdentifier
		})
	);
}

function markRetiredAssetRemovalFailed(
	ctx: ActionCtx,
	asset: RetiredAssetPermission,
	editorTokenIdentifier: string,
	error: EditorRetirementError
) {
	if (asset.bookingId === null) return errAsync(error);

	return markPreviousEditorRemovalFailed(ctx, {
		bookingId: asset.bookingId,
		editorTokenIdentifier
	}).andThen(() => errAsync(error));
}

function removeRetiredAssetPermission(
	ctx: ActionCtx,
	asset: RetiredAssetPermission,
	editorTokenIdentifier: string,
	drive: DriveClient
) {
	if (asset.assetsFolderId === null) {
		return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return deleteDrivePermission(drive, {
		fileId: asset.assetsFolderId,
		permissionId: asset.permission.assetsPermission.id
	})
		.andThen(() => clearRetiredAssetPermission(ctx, asset.permission, editorTokenIdentifier))
		.orElse((error: EditorRetirementError) =>
			markRetiredAssetRemovalFailed(ctx, asset, editorTokenIdentifier, error)
		);
}

function removeRetiredAssetsAt(
	ctx: ActionCtx,
	assets: RetiredAssetPermission[],
	index: number,
	editorTokenIdentifier: string,
	drive: DriveClient,
	firstError?: EditorRetirementError
): ResultAsync<null, EditorRetirementError> {
	const asset = assets[index];

	if (asset === undefined) {
		return firstError === undefined ? okAsync(null) : errAsync(firstError);
	}

	return removeRetiredAssetPermission(ctx, asset, editorTokenIdentifier, drive)
		.map(() => firstError)
		.orElse((error) => okAsync(firstError ?? error))
		.andThen((nextError) =>
			removeRetiredAssetsAt(ctx, assets, index + 1, editorTokenIdentifier, drive, nextError)
		);
}

function recordRetirementAssetsFailure(
	ctx: ActionCtx,
	assets: RetiredAssetPermission[],
	editorTokenIdentifier: string,
	error: EditorRetirementError
) {
	return ResultAsync.combine(
		assets.map((asset) =>
			asset.bookingId === null
				? okAsync(null)
				: markPreviousEditorRemovalFailed(ctx, {
						bookingId: asset.bookingId,
						editorTokenIdentifier
					})
		)
	).andThen(() => errAsync(error));
}

function removeRetirementAssetRows(
	ctx: ActionCtx,
	editorTokenIdentifier: string,
	assets: RetiredAssetPermission[]
) {
	if (assets.length === 0) return okAsync(null);

	return loadDriveClient()
		.orElse((error) => recordRetirementAssetsFailure(ctx, assets, editorTokenIdentifier, error))
		.andThen((drive) => removeRetiredAssetsAt(ctx, assets, 0, editorTokenIdentifier, drive));
}

function removeEditorRetirementAssets(ctx: ActionCtx, editorTokenIdentifier: string) {
	return loadEditorRetirementAssets(ctx, editorTokenIdentifier).andThen((assets) =>
		removeRetirementAssetRows(ctx, editorTokenIdentifier, assets)
	);
}

function removeRetiredSessionAccess(
	ctx: ActionCtx,
	bookingId: Doc<"bookings">["_id"],
	editorTokenIdentifier: string
) {
	return loadEditorDriveAccessToRemove(ctx, { bookingId, editorTokenIdentifier }).andThen(
		(access) =>
			removePreviousEditorDriveAccess(ctx, {
				access,
				previousEditorTokenIdentifier: editorTokenIdentifier
			})
	);
}

function ignoreFailedRemoval(_error: EditorRetirementError) {
	return okAsync(null);
}

function removeRetiredSessionAndRecordFailure(
	ctx: ActionCtx,
	bookingId: Doc<"bookings">["_id"],
	editorTokenIdentifier: string
) {
	return removeRetiredSessionAccess(ctx, bookingId, editorTokenIdentifier).orElse((error) =>
		markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier }).andThen(() =>
			ignoreFailedRemoval(error)
		)
	);
}

function retryRetiredPreviousRemoval(ctx: ActionCtx, bookingId: Doc<"bookings">["_id"]) {
	return retryFailedPreviousEditorRemoval(ctx, { bookingId }).orElse(ignoreFailedRemoval);
}

function markPendingEditorAccessRevoked(
	ctx: ActionCtx,
	driveSessionId: Doc<"driveSessions">["_id"],
	editorTokenIdentifier: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.driveInternal.markEditorDriveAccessRevoked, {
			driveSessionId,
			editorTokenIdentifier
		})
	);
}

function removeRetiredSession(
	ctx: ActionCtx,
	session: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	if (session.editorDrivePermissionsTokenIdentifier === editorTokenIdentifier) {
		return removeRetiredSessionAndRecordFailure(ctx, session.bookingId, editorTokenIdentifier);
	}

	if (session.failedRemovalEditorTokenIdentifier === editorTokenIdentifier) {
		return retryRetiredPreviousRemoval(ctx, session.bookingId);
	}

	if (session.editorDrivePermissionsTokenIdentifier === undefined) {
		return markPendingEditorAccessRevoked(ctx, session._id, editorTokenIdentifier);
	}

	return okAsync(null);
}

function revokeRetiredEditorDriveAccess(
	ctx: ActionCtx,
	sessions: Doc<"driveSessions">[],
	editorTokenIdentifier: string
): ResultAsync<null, EditorRetirementError> {
	return sessions
		.reduce<ResultAsync<null, EditorRetirementError>>(
			(result, session) =>
				result.andThen(() => removeRetiredSession(ctx, session, editorTokenIdentifier)),
			okAsync<null, EditorRetirementError>(null)
		)
		.andThen(() => removeEditorRetirementAssets(ctx, editorTokenIdentifier));
}

export function retireEditorDriveAccess(
	ctx: ActionCtx,
	args: { editorTokenIdentifier: string }
): ResultAsync<null, EditorRetirementError> {
	return loadEditorRetirementSessions(ctx, args.editorTokenIdentifier).andThen((sessions) =>
		revokeRetiredEditorDriveAccess(ctx, sessions, args.editorTokenIdentifier)
	);
}
