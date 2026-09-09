import { errAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getDriveSetup } from "#convex/lib/driveLookup";
import { buildClientDrivePermissionsStatus, getDriveStatus } from "#convex/lib/driveStatus";
import { okOrThrow } from "#convex/lib/result";
import type { SavedDrivePermission } from "#convex/lib/googleDrive";

const dismissedDrivePermission = (role: SavedDrivePermission["role"]): SavedDrivePermission => ({
	id: "dismissed",
	role
});

function getDismissedClientPermissions(driveClient: Doc<"driveClients">) {
	const patches: Partial<Doc<"driveClients">> = {};
	// Normal setup saves this after sharing the client folder; write a placeholder so the dialog stops showing incomplete.
	if (driveClient.clientFolderPermission === undefined) {
		patches.clientFolderPermission = dismissedDrivePermission("reader");
	}
	// Same for the _Assets folder share record.
	if (driveClient.assetsClientPermission === undefined) {
		patches.assetsClientPermission = dismissedDrivePermission("writer");
	}
	return patches;
}

type ClientDrivePermissionsDisplay = ReturnType<typeof buildClientDrivePermissionsStatus>;

function getDismissedDriveSessionPatches(args: {
	booking: Doc<"bookings">;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions">;
	clientDrivePermissionsStatus: ClientDrivePermissionsDisplay["status"];
	clientAssetsEmailStatus: ClientDrivePermissionsDisplay["assetsEmailStatus"];
	editorDrivePermissionsStatus: "failed" | "not_assigned" | "pending" | "ready";
	editorAssignmentEmailStatus: "failed" | "not_sent" | "pending" | "sent";
}) {
	const {
		booking,
		driveClient,
		driveSession,
		clientDrivePermissionsStatus,
		clientAssetsEmailStatus,
		editorDrivePermissionsStatus,
		editorAssignmentEmailStatus
	} = args;
	const now = Date.now();
	const patches: Partial<Doc<"driveSessions">> = { updatedAt: now };
	const editorTokenIdentifier = booking.assignedEditorTokenIdentifier;
	const assetsFolderId = driveClient?.assetsFolder?.id;

	// Failed or incomplete client permissions keep the sessions table flagged.
	if (clientDrivePermissionsStatus === "failed" || clientDrivePermissionsStatus === "incomplete") {
		patches.clientDrivePermissionsStatus = "ready";
	}

	// Record the assets email as sent without calling Resend again.
	if (clientAssetsEmailStatus === "failed" && assetsFolderId !== undefined) {
		patches.assetsEmailStatus = "sent";
		patches.assetsEmailFolderId = assetsFolderId;
		patches.assetsEmailClaimedAt = undefined;
	}

	// Folders exist but editor Drive access never finished setup.
	if (
		editorTokenIdentifier !== undefined &&
		(editorDrivePermissionsStatus === "failed" || editorDrivePermissionsStatus === "pending")
	) {
		patches.editorDrivePermissionsStatus = "ready";
		patches.editorDrivePermissionsTokenIdentifier = editorTokenIdentifier;
	}

	// Record the assignment email as sent without calling Resend again.
	if (editorTokenIdentifier !== undefined && editorAssignmentEmailStatus === "failed") {
		patches.assignmentEmailStatus = "sent";
		patches.assignmentEmailTokenIdentifier = editorTokenIdentifier;
		patches.assignmentEmailClaimedAt = undefined;
	}

	// Reassigning an editor tries to revoke the old editor's Drive access. If that fails, the old
	// editor's id is stored here and the admin UI warns until it is cleared.
	if (driveSession.failedRemovalEditorTokenIdentifier !== undefined) {
		patches.failedRemovalEditorTokenIdentifier = undefined;
	}

	return patches;
}

export type ClearDriveWorkflowFailureError = {
	reason: "BOOKING_NOT_FOUND" | "DRIVE_FOLDERS_NOT_READY" | "DRIVE_WORKFLOW_NOT_FAILED";
};

export function clearDriveWorkflowFailure(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, ClearDriveWorkflowFailureError> {
	return getDriveStatus(ctx, bookingId).andThen((driveStatus) => {
		if (!driveStatus.hasDriveWorkflowFailure) {
			return errAsync({ reason: "DRIVE_WORKFLOW_NOT_FAILED" as const });
		}
		// Refuse to clear while this session is still missing folder links.
		if (driveStatus.status !== "ready") {
			return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
		}

		return getDriveSetup(ctx, bookingId).andThen((setupInfo) => {
			if (setupInfo === null) {
				return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
			}
			if (setupInfo.driveSession === null) {
				return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
			}

			const bookingPatches: Partial<Doc<"bookings">> = {};
			// Folder setup failed earlier but folders were created or fixed later.
			if (setupInfo.booking.driveSetupFailureCode !== undefined) {
				bookingPatches.driveSetupFailedAt = undefined;
				bookingPatches.driveSetupFailureCode = undefined;
			}
			// Permission retries read booking.driveClientId. Older bookings only got that id on
			// driveSessions when an admin first ran folder setup.
			if (setupInfo.booking.driveClientId === undefined) {
				bookingPatches.driveClientId = setupInfo.driveSession.driveClientId;
			}

			const driveSessionPatches = getDismissedDriveSessionPatches({
				booking: setupInfo.booking,
				driveClient: setupInfo.driveClient,
				driveSession: setupInfo.driveSession,
				clientDrivePermissionsStatus: driveStatus.clientDrivePermissions.status,
				clientAssetsEmailStatus: driveStatus.clientDrivePermissions.assetsEmailStatus,
				editorDrivePermissionsStatus: driveStatus.editorDrivePermissions.status,
				editorAssignmentEmailStatus: driveStatus.editorDrivePermissions.assignmentEmailStatus
			});
			const driveClientPatches =
				setupInfo.driveClient === null ? {} : getDismissedClientPermissions(setupInfo.driveClient);

			return okOrThrow(
				Promise.all([
					Object.keys(bookingPatches).length > 0
						? ctx.db.patch(setupInfo.booking._id, bookingPatches)
						: Promise.resolve(),
					Object.keys(driveSessionPatches).length > 1
						? ctx.db.patch(setupInfo.driveSession._id, driveSessionPatches)
						: Promise.resolve(),
					setupInfo.driveClient !== null && Object.keys(driveClientPatches).length > 0
						? ctx.db.patch(setupInfo.driveClient._id, driveClientPatches)
						: Promise.resolve()
				]).then(() => null)
			);
		});
	});
}
