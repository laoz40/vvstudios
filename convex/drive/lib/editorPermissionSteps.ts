import { exhaustiveCheck } from "#/lib/result";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/drive/lib/driveLookup";
import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { DriveSetupInfo } from "#convex/drive/lib/driveLookup";
import type { SavedDrivePermission } from "#convex/drive/lib/googleDrive";

export type EditorPermissionArgs = {
	bookingId: Id<"bookings">;
	editorTokenIdentifier: string;
	name: "Assets" | "Deliverables" | "Session";
	permission: SavedDrivePermission;
};

export type EditorPermissionSetupContext = {
	driveClientId: Id<"driveClients">;
	driveSessionId: Id<"driveSessions">;
};

export function requireEditorPermissionSetup(
	setup: DriveSetupInfo | null,
	args: EditorPermissionArgs
) {
	if (
		setup === null ||
		setup.driveClient === null ||
		setup.driveSession === null ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return ok({ driveClientId: setup.driveClient._id, driveSessionId: setup.driveSession._id });
}

export function requireEditorPermissionStatusSetup(
	setup: DriveSetupInfo | null,
	args: { editorTokenIdentifier: string }
) {
	if (
		setup === null ||
		setup.driveSession === null ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return ok(setup.driveSession);
}

export function requireEditorAssignmentEmailSetup(
	setup: DriveSetupInfo | null,
	args: { editorTokenIdentifier: string }
) {
	if (
		setup === null ||
		setup.driveSession === null ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier ||
		setup.driveSession.editorDrivePermissionsStatus !== "ready" ||
		setup.driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
	}

	return ok({ ...setup, driveSession: setup.driveSession } satisfies DriveSetupInfo & {
		driveSession: Doc<"driveSessions">;
	});
}

export type ClaimEditorAssignmentEmailArgs = {
	bookingId: Id<"bookings">;
	editorTokenIdentifier: string;
	now: number;
};

export function canClaimEditorAssignmentEmail(
	driveSession: Doc<"driveSessions">,
	args: ClaimEditorAssignmentEmailArgs
) {
	const emailMatchesEditor =
		driveSession.assignmentEmailTokenIdentifier === args.editorTokenIdentifier;

	if (!emailMatchesEditor) return true;

	const claimedRecently =
		driveSession.assignmentEmailClaimedAt !== undefined &&
		args.now - driveSession.assignmentEmailClaimedAt < DRIVE_EMAIL_CLAIM_TIMEOUT_MS;

	if (claimedRecently) return false;

	switch (driveSession.assignmentEmailStatus) {
		case "failed":
		case undefined:
			return true;
		case "sent":
			return false;
		default:
			return exhaustiveCheck(driveSession.assignmentEmailStatus);
	}
}
