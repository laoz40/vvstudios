import { okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { lookupEditorProfileByToken } from "#convex/editor/lib/editorAssignments";
import {
	incrementEditorTotalEdits,
	patchSessionEditStatus
} from "#convex/editor/lib/editorSessions";

function incrementEditorTotalEditsForProfile(
	ctx: MutationCtx,
	editor: Doc<"editorProfiles"> | null
) {
	if (editor === null) {
		return okAsync(null);
	}

	return incrementEditorTotalEdits(ctx, editor._id, editor.totalEdits);
}

function incrementEditorTotalEditsAfterPatch(
	ctx: MutationCtx,
	editor: Doc<"editorProfiles"> | null
) {
	return incrementEditorTotalEditsForProfile(ctx, editor);
}

function patchEditStatusThenCreditEditor(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed",
	editor: Doc<"editorProfiles"> | null
) {
	return patchSessionEditStatus(ctx, session._id, editStatus).andThen(() =>
		incrementEditorTotalEditsAfterPatch(ctx, editor)
	);
}

function patchEditStatusAndCreditEditor(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed",

	editor: Doc<"editorProfiles"> | null
) {
	return patchEditStatusThenCreditEditor(ctx, session, editStatus, editor);
}

export function saveSessionEditStatus(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	const editorTokenIdentifier = session.assignedEditorTokenIdentifier;

	// Credit each transition into Completed. A duplicate credit requires an unlikely manual
	// Completed → Editing → Completed cycle, so we avoid adding persistent tracking for it.
	const shouldIncrementTotal =
		editStatus === "completed" &&
		session.editStatus !== "completed" &&
		editorTokenIdentifier !== undefined;

	if (!shouldIncrementTotal) {
		return patchSessionEditStatus(ctx, session._id, editStatus);
	}

	return lookupEditorProfileByToken(ctx, editorTokenIdentifier).andThen(
		(editor: Doc<"editorProfiles"> | null) =>
			patchEditStatusAndCreditEditor(ctx, session, editStatus, editor)
	);
}
