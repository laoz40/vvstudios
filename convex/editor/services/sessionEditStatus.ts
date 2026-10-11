import { loadEditorForCompletedTransition } from "#convex/editor/lib/sessionEditStatusSteps";

import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

import { patchSessionEditStatus } from "#convex/editor/lib/editorSessions";
import { incrementEditorTotalEdits } from "#convex/editor/lib/editorSessions";

export function saveSessionEditStatus(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	return loadEditorForCompletedTransition(ctx, session, editStatus).andThen((editor) =>
		patchSessionEditStatus(ctx, session._id, editStatus).andThen(() =>
			incrementEditorTotalEdits(ctx, editor)
		)
	);
}
