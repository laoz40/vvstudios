import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { loadDriveSessionRowByBookingId } from "#convex/drive/lib/driveBookingDriveClient";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { scheduleAdminNotesEmail } from "#convex/sessions/lib/notesNotification";
import {
	editorAssignmentAccessState,
	editorAssignmentSearchInput,
	loadEditorForSessionAssignment,
	validateEditorDueDate,
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
	adminNotes: string,
	editorDueDate: string | undefined
): ResultAsync<null, never> {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, session._id);

		return ok(
			yield* saveSessionEditorAssignmentWithAccess(
				ctx,
				session,
				editor,
				adminNotes,
				editorDueDate,
				driveSession
			)
		);
	});
}

function saveSessionEditorAssignmentWithAccess(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string,
	editorDueDate: string | undefined,
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<null, never> {
	const {
		previousEditorTokenIdentifier,
		assignedEditorDisplayName,
		previousEditorNeedsAccessRemoved,
		isFirstAssignment
	} = editorAssignmentAccessState(session, editor, driveSession);

	return safeTry(async function* () {
		const searchBlobPatch = yield* searchBlobPatchForBookingAsync(
			ctx,
			editorAssignmentSearchInput(session, editor, assignedEditorDisplayName)
		);

		yield* patchEditorAssignmentAfterSearch(
			ctx,
			session,
			editor,
			adminNotes,
			editorDueDate,
			searchBlobPatch
		);
		yield* patchLastAssignedIfEditor(ctx, editor);
		yield* scheduleAdminNotesEmail(ctx, session, adminNotes, editor);
		yield* scheduleDriveAccessRemovalIfNeeded(
			ctx,
			session._id,
			previousEditorNeedsAccessRemoved,
			previousEditorTokenIdentifier
		);

		return ok(yield* scheduleFirstAssignmentDriveSetup(ctx, session._id, isFirstAssignment));
	});
}

export function updateSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorTokenIdentifier: string | null,
	adminNotes: string,
	editorDueDate: string | undefined
): ResultAsync<
	null,
	{
		reason:
			| "BOOKING_NOT_FOUND"
			| "INVALID_EDITOR_DUE_DATE"
			| "EDITOR_NOT_ACTIVE"
			| "SESSION_NOT_ASSIGNABLE"
			| "NOT_AUTHENTICATED"
			| "NOT_AUTHORIZED";
	}
> {
	return safeTry(async function* () {
		yield* validateEditorDueDate(editorDueDate);

		const selectedEditor = yield* loadEditorForSessionAssignment(
			ctx,
			session,
			editorTokenIdentifier
		);

		const editor = yield* requireSelectedAssignmentEditor(selectedEditor);

		return ok(yield* saveSessionEditorAssignment(ctx, session, editor, adminNotes, editorDueDate));
	});
}
