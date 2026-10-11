import { okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import type { EditorSessionDriveFolders } from "#convex/drive/lib/driveStatus";
import { loadDriveSessionRowByBookingId } from "#convex/drive/lib/driveBookingDriveClient";

type DriveClient = Doc<"driveClients"> | null;

export function loadAssignedEditorDriveSession(ctx: QueryCtx, booking: Doc<"bookings">) {
	const token = booking.assignedEditorTokenIdentifier;

	if (token === undefined) return okAsync<Doc<"driveSessions"> | null>(null);

	return loadDriveSessionRowByBookingId(ctx, booking._id).map((session) =>
		session !== null &&
		session.editorDrivePermissionsStatus === "ready" &&
		session.editorDrivePermissionsTokenIdentifier === token
			? session
			: null
	);
}

export function editorDriveFoldersForRows(
	driveSession: Doc<"driveSessions"> | null,
	driveClient: DriveClient
): Omit<EditorSessionDriveFolders, "sessionFolderName"> | null {
	if (driveSession === null) return null;

	const assetsFolder = driveClient?.assetsFolder;
	const sessionFolder = driveSession.sessionFolder;
	const rawMediaFolder = driveSession.rawMediaFolder;
	const deliverablesFolder = driveSession.deliverablesFolder;

	if (
		assetsFolder === undefined ||
		sessionFolder === undefined ||
		rawMediaFolder === undefined ||
		deliverablesFolder === undefined
	) {
		return null;
	}

	return {
		assets: assetsFolder,
		deliverables: deliverablesFolder,
		rawMedia: rawMediaFolder,
		session: sessionFolder
	};
}

export function selectEditorDriveFolderDetails(
	session: Doc<"driveSessions"> | null,
	client: DriveClient
) {
	const folders = editorDriveFoldersForRows(session, client);

	return session === null || folders === null ? [] : [{ session, folders }];
}
