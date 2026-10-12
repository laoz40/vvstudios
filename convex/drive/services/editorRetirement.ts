"use node";

import { err, ok, okAsync, ResultAsync, safeTry } from "neverthrow";
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
	const removal = safeTry<null, EditorRetirementError>(async function* () {
		const request = yield* requireRetiredAssetPermissionRemoval(asset, drive);
		yield* deleteDrivePermission(request.drive, {
			fileId: request.fileId,
			permissionId: request.permissionId
		});

		return ok(
			yield* writeRetiredAssetPermissionRemoval(ctx, asset.permission._id, editorTokenIdentifier)
		);
	});

	return removal.orElse((error) =>
		recordRetiredAssetRemovalError(ctx, asset, editorTokenIdentifier, error)
	);
}

function recordRetiredAssetRemovalError(
	ctx: ActionCtx,
	asset: RetiredAssetPermission,
	editorTokenIdentifier: string,
	error: EditorRetirementError
) {
	return safeTry(async function* () {
		yield* recordRetiredAssetRemovalFailure(ctx, asset.bookingId, editorTokenIdentifier);

		return err(error);
	});
}

function removeRetirementAssetRows(
	ctx: ActionCtx,
	editorTokenIdentifier: string,
	assets: RetiredAssetPermission[]
): ResultAsync<null, EditorRetirementError> {
	const removal = safeTry<null, EditorRetirementError>(async function* () {
		const drive = yield* loadDriveClientForRetirementAssets(assets).orElse((error) =>
			recordRetirementAssetsDriveFailure(ctx, assets, editorTokenIdentifier, error)
		);

		const firstError = yield* assets.reduce(
			(previousError, asset) =>
				safeTry(async function* () {
					const first = yield* previousError;

					return ok(
						yield* removeRetiredAssetPermission(ctx, asset, editorTokenIdentifier, drive)
							.map(() => first)
							.orElse((error) => ok(first ?? error))
					);
				}),
			okAsync<EditorRetirementError | undefined>(undefined)
		);

		return ok(yield* finishRetirementAssetRemoval(firstError));
	});

	return removal;
}

function removeRetiredSessionAndRecordFailure(
	ctx: ActionCtx,
	request: { bookingId: Doc<"bookings">["_id"]; editorTokenIdentifier: string } | null,
	editorTokenIdentifier: string
) {
	const remove = safeTry<null, EditorRetirementError>(async function* () {
		const access = yield* loadEditorDriveAccessToRemove(ctx, request);

		return ok(
			yield* removePreviousEditorDriveAccess(ctx, {
				access,
				previousEditorTokenIdentifier: editorTokenIdentifier
			})
		);
	});

	return remove.orElse(() =>
		recordRetiredAssetRemovalFailure(ctx, request?.bookingId ?? null, editorTokenIdentifier)
	);
}

function recordRetirementAssetsDriveFailure(
	ctx: ActionCtx,
	assets: RetiredAssetPermission[],
	editorTokenIdentifier: string,
	error: DriveError
) {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			retiredAssetBookingIds(assets).map((bookingId) =>
				markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier })
			)
		);

		return err(error);
	});
}

function removeRetiredSession(
	ctx: ActionCtx,
	session: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	const plan = planEditorRetirementSession(session, editorTokenIdentifier);

	return safeTry(async function* () {
		yield* removeRetiredSessionAndRecordFailure(ctx, plan.removalRequest, editorTokenIdentifier);
		yield* retryFailedPreviousEditorRemoval(ctx, plan.retryRequest).orElse(() => ok(null));

		return ok(
			yield* writeEditorDriveAccessRevoked(ctx, plan.revokeSessionId, editorTokenIdentifier)
		);
	});
}

export function retireEditorDriveAccess(
	ctx: ActionCtx,
	args: { editorTokenIdentifier: string }
): ResultAsync<null, EditorRetirementError> {
	return safeTry(async function* () {
		const sessions: Doc<"driveSessions">[] = yield* queryEditorRetirementSessions(
			ctx,
			args.editorTokenIdentifier
		);

		for (const session of sessions) {
			yield* removeRetiredSession(ctx, session, args.editorTokenIdentifier);
		}

		const assets = yield* queryEditorRetirementAssets(ctx, args.editorTokenIdentifier);

		return ok(yield* removeRetirementAssetRows(ctx, args.editorTokenIdentifier, assets));
	});
}
