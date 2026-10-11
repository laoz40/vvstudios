import { type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { loadDriveSessionRowByBookingId } from "#convex/drive/lib/driveBookingDriveClient";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";
import {
	editorAssignmentAccessState,
	editorAssignmentSearchInput,
	loadEditorForSessionAssignment,
	requireSelectedAssignmentEditor,
	patchEditorAssignmentAfterSearch,
	patchLastAssignedIfEditor,
	scheduleDriveAccessRemovalIfNeeded,
	scheduleFirstAssignmentDriveSetup
} from "#convex/sessions/lib/editorAssignmentSteps";

function saveSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
): ResultAsync<null, never> {
	return loadDriveSessionRowByBookingId(ctx, session._id).andThen((driveSession) =>
		saveSessionEditorAssignmentWithAccess(ctx, session, editor, adminNotes, driveSession)
	);
}

function saveSessionEditorAssignmentWithAccess(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string,
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<null, never> {
	const {
		previousEditorTokenIdentifier,
		assignedEditorDisplayName,
		previousEditorNeedsAccessRemoved,
		isFirstAssignment
	} = editorAssignmentAccessState(session, editor, driveSession);

	return searchBlobPatchForBookingAsync(
		ctx,
		editorAssignmentSearchInput(session, editor, assignedEditorDisplayName)
	)
		.andThen((searchBlobPatch: BookingSearchBlobPatch) =>
			patchEditorAssignmentAfterSearch(ctx, session, editor, adminNotes, searchBlobPatch)
		)
		.andThen(() => patchLastAssignedIfEditor(ctx, editor))
		.andThen(() =>
			scheduleDriveAccessRemovalIfNeeded(
				ctx,
				session._id,
				previousEditorNeedsAccessRemoved,
				previousEditorTokenIdentifier
			)
		)
		.andThen(() => scheduleFirstAssignmentDriveSetup(ctx, session._id, isFirstAssignment));
}

export function updateSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorTokenIdentifier: string | null,
	adminNotes: string
) {
	return loadEditorForSessionAssignment(ctx, session, editorTokenIdentifier)
		.andThen(requireSelectedAssignmentEditor)
		.andThen((editor) => saveSessionEditorAssignment(ctx, session, editor, adminNotes));
}
