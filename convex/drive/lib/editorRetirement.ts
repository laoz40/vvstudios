import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, QueryCtx } from "#convex/_generated/server";
import { internal } from "#convex/_generated/api";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import type { DriveClient } from "#convex/drive/lib/googleDrive";
import { writePreviousEditorRemovalFailed } from "#convex/drive/lib/editorDrivePermissionsSteps";
import { loadEditorAssetPermissionRetirementInfo } from "#convex/drive/lib/driveEditor";

export type EditorRetirementSessionRows = {
	permissionSessions: Doc<"driveSessions">[];
	failedRemovalSessions: Doc<"driveSessions">[];
	assignedBookings: Doc<"bookings">[];
};

export function getCompletedEditorBookingIds(bookings: Doc<"bookings">[]) {
	return bookings.flatMap((booking) => (booking.editStatus === "completed" ? [booking._id] : []));
}

export function queryEditorRetirementSessions(ctx: ActionCtx, editorTokenIdentifier: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.drive.getEditorRetirementSessions, { editorTokenIdentifier })
	);
}

export function queryEditorRetirementAssets(ctx: ActionCtx, editorTokenIdentifier: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.drive.getEditorRetirementAssets, { editorTokenIdentifier })
	);
}

export function writeRetiredAssetPermissionRemoval(
	ctx: ActionCtx,
	permissionId: Id<"driveClientEditorPermissions">,
	editorTokenIdentifier: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.clearEditorAssetPermission, {
			permissionId,
			editorTokenIdentifier
		})
	);
}

export function writeEditorDriveAccessRevoked(
	ctx: ActionCtx,
	driveSessionId: Id<"driveSessions"> | null,
	editorTokenIdentifier: string
) {
	if (driveSessionId === null) return okAsync(null);

	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.markEditorDriveAccessRevoked, {
			driveSessionId,
			editorTokenIdentifier
		})
	);
}

export function mergeEditorRetirementSessions(
	retirementRows: EditorRetirementSessionRows,
	pendingSessions: (Doc<"driveSessions"> | null)[]
) {
	const { permissionSessions, failedRemovalSessions } = retirementRows;
	const sessions = new Map(permissionSessions.map((session) => [session._id, session]));

	for (const session of failedRemovalSessions) sessions.set(session._id, session);

	for (const session of pendingSessions) {
		if (session !== null) sessions.set(session._id, session);
	}

	return [...sessions.values()];
}

export function loadEditorRetirementAssetInfos(
	ctx: QueryCtx,
	permissions: Doc<"driveClientEditorPermissions">[]
) {
	return ResultAsync.combine(
		permissions.map((permission) => loadEditorAssetPermissionRetirementInfo(ctx, permission))
	);
}

export function getEditorRetirementAction(
	session: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	if (session.editorDrivePermissionsTokenIdentifier === editorTokenIdentifier) return "remove";

	if (session.failedRemovalEditorTokenIdentifier === editorTokenIdentifier) return "retry";

	if (session.editorDrivePermissionsTokenIdentifier === undefined) return "revoke";

	return "none";
}

export type RetiredAssetPermission = {
	assetsFolderId: string | null;
	bookingId: Id<"bookings"> | null;
	permission: Doc<"driveClientEditorPermissions">;
};

export function requireRetiredAssetPermissionRemoval(
	asset: RetiredAssetPermission,
	drive: DriveClient | null
): Result<
	{ drive: DriveClient; fileId: string; permissionId: string },
	{ reason: "DRIVE_RECORD_NOT_FOUND" }
> {
	if (asset.assetsFolderId === null || drive === null)
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" });

	return ok({
		drive,
		fileId: asset.assetsFolderId,
		permissionId: asset.permission.assetsPermission.id
	});
}

export function recordRetiredAssetRemovalFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings"> | null,
	editorTokenIdentifier: string
) {
	if (bookingId === null) return okAsync(null);

	return writePreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier });
}

export function retiredAssetBookingIds(assets: RetiredAssetPermission[]) {
	return assets.flatMap((asset) => (asset.bookingId === null ? [] : [asset.bookingId]));
}

export function finishRetirementAssetRemoval<E extends { reason: string }>(
	firstError: E | undefined
): Result<null, E> {
	if (firstError !== undefined) return err(firstError);

	return ok(null);
}

export function planEditorRetirementSession(
	session: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	const action = getEditorRetirementAction(session, editorTokenIdentifier);

	return {
		removalRequest:
			action === "remove" ? { bookingId: session.bookingId, editorTokenIdentifier } : null,
		retryRequest: action === "retry" ? { bookingId: session.bookingId } : null,
		revokeSessionId: action === "revoke" ? session._id : null
	};
}
