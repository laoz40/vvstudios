import { okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { lookupEditorProfileByToken } from "#convex/lib/editor/editorAssignments";
import {
	incrementEditorTotalEdits,
	patchSessionEditStatus
} from "#convex/lib/editor/editorSessions";

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

	return lookupEditorProfileByToken(ctx, editorTokenIdentifier).andThen((editor) =>
		patchSessionEditStatus(ctx, session._id, editStatus).andThen(() => {
			if (editor === null) {
				return okAsync(null);
			}

			return incrementEditorTotalEdits(ctx, editor._id, editor.totalEdits);
		})
	);
}
