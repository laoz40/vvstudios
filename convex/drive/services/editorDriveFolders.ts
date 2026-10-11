import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { loadDriveClientRow } from "#convex/drive/lib/driveBookingDriveClient";
import {
	selectEditorDriveFolderDetails,
	loadAssignedEditorDriveSession
} from "#convex/drive/lib/editorDriveFolders";
import type { EditorSessionDriveFolders } from "#convex/drive/lib/driveStatus";
import { resolveSessionFolderDisplayName } from "#convex/drive/services/sessionFolderNames";

export function loadEditorSessionDriveFolders(
	ctx: QueryCtx,
	booking: Doc<"bookings">
): ResultAsync<EditorSessionDriveFolders | null, never> {
	return loadAssignedEditorDriveSession(ctx, booking).andThen((session) =>
		loadDriveClientRow(ctx, session?.driveClientId ?? null).andThen((client) =>
			ResultAsync.combine(
				selectEditorDriveFolderDetails(session, client).map((details) =>
					resolveSessionFolderDisplayName(ctx, booking, details.session).map(
						(sessionFolderName) => ({ ...details.folders, sessionFolderName })
					)
				)
			).map((folders) => folders[0] ?? null)
		)
	);
}
