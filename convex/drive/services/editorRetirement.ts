"use node";

import { err, ok, okAsync, ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { type DriveClient, type DriveError } from "#convex/drive/lib/googleDrive";
import {
	writeRetiredAssetPermissionRemoval,
	queryEditorRetirementAssets,
	queryEditorRetirementSessions,
	writeEditorDriveAccessRevoked,
	requireRetiredAssetPermissionRemoval,
	recordRetiredAssetRemovalFailure,
	retiredAssetBookingIds,
	finishRetirementAssetRemoval,
	planEditorRetirementSession,
	type RetiredAssetPermission
} from "#convex/drive/lib/editorRetirement";
import { loadDriveClientForRetirementAssets } from "#convex/drive/lib/editorDrivePermissionIo";
import { deleteDrivePermission } from "#convex/drive/services/googleDriveOperations";
import {
	loadEditorDriveAccessToRemove,
	markPreviousEditorRemovalFailed,
	removePreviousEditorDriveAccess,
	type DriveEditorPermissionsError
} from "#convex/drive/services/editorDrivePermissions";
import { retryFailedPreviousEditorRemoval } from "#convex/drive/services/driveEditorPermissions";

type EditorRetirementError = DriveEditorPermissionsError | DriveError;

function removeRetiredAssetPermission(
	ctx: ActionCtx,
	asset: RetiredAssetPermission,
	editorTokenIdentifier: string,
	drive: DriveClient | null
): ResultAsync<null, EditorRetirementError> {
	return requireRetiredAssetPermissionRemoval(asset, drive)
		.asyncAndThen((request) =>
			deleteDrivePermission(request.drive, {
				fileId: request.fileId,
				permissionId: request.permissionId
			})
		)
		.andThen(() =>
			writeRetiredAssetPermissionRemoval(ctx, asset.permission._id, editorTokenIdentifier)
		)
		.orElse((error) =>
			recordRetiredAssetRemovalFailure(ctx, asset.bookingId, editorTokenIdentifier).andThen(() =>
				err(error)
			)
		);
}

function removeRetirementAssetRows(
	ctx: ActionCtx,
	editorTokenIdentifier: string,
	assets: RetiredAssetPermission[]
): ResultAsync<null, EditorRetirementError> {
	return loadDriveClientForRetirementAssets(assets)
		.orElse((error) =>
			ResultAsync.combine(
				retiredAssetBookingIds(assets).map((bookingId) =>
					markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier })
				)
			).andThen(() => err(error))
		)
		.andThen((drive) =>
			assets
				.reduce(
					(previous, asset) =>
						previous.andThen((firstError) =>
							removeRetiredAssetPermission(ctx, asset, editorTokenIdentifier, drive)
								.map(() => firstError)
								.orElse((error) => ok(firstError ?? error))
						),
					okAsync<EditorRetirementError | undefined>(undefined)
				)
				.andThen(finishRetirementAssetRemoval)
		);
}

function removeRetiredSessionAndRecordFailure(
	ctx: ActionCtx,
	request: { bookingId: Doc<"bookings">["_id"]; editorTokenIdentifier: string } | null,
	editorTokenIdentifier: string
) {
	return loadEditorDriveAccessToRemove(ctx, request)
		.andThen((access) =>
			removePreviousEditorDriveAccess(ctx, {
				access,
				previousEditorTokenIdentifier: editorTokenIdentifier
			})
		)
		.orElse(() =>
			recordRetiredAssetRemovalFailure(ctx, request?.bookingId ?? null, editorTokenIdentifier).map(
				() => null
			)
		);
}

function removeRetiredSession(
	ctx: ActionCtx,
	session: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	const plan = planEditorRetirementSession(session, editorTokenIdentifier);

	return removeRetiredSessionAndRecordFailure(ctx, plan.removalRequest, editorTokenIdentifier)
		.andThen(() => retryFailedPreviousEditorRemoval(ctx, plan.retryRequest).orElse(() => ok(null)))
		.andThen(() => writeEditorDriveAccessRevoked(ctx, plan.revokeSessionId, editorTokenIdentifier));
}

export function retireEditorDriveAccess(
	ctx: ActionCtx,
	args: { editorTokenIdentifier: string }
): ResultAsync<null, EditorRetirementError> {
	return queryEditorRetirementSessions(ctx, args.editorTokenIdentifier)
		.andThen((sessions) =>
			sessions.reduce(
				(previous, session) =>
					previous.andThen(() => removeRetiredSession(ctx, session, args.editorTokenIdentifier)),
				okAsync<null, EditorRetirementError>(null)
			)
		)
		.andThen(() => queryEditorRetirementAssets(ctx, args.editorTokenIdentifier))
		.andThen((assets) => removeRetirementAssetRows(ctx, args.editorTokenIdentifier, assets));
}
