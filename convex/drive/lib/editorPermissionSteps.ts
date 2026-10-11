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
