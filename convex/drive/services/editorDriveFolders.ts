import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const session = yield* loadAssignedEditorDriveSession(ctx, booking);
		const client = yield* loadDriveClientRow(ctx, session?.driveClientId ?? null);
		const details = selectEditorDriveFolderDetails(session, client);

		const folders = yield* ResultAsync.combine(
			details.map((detail) =>
				resolveSessionFolderDisplayName(ctx, booking, detail.session).map((sessionFolderName) => ({
					...detail.folders,
					sessionFolderName
				}))
			)
		);

		return ok(folders[0] ?? null);
	});
}
