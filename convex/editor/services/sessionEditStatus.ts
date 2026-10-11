import { ok, safeTry } from "neverthrow";

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
	return safeTry(async function* () {
		const editor = yield* loadEditorForCompletedTransition(ctx, session, editStatus);

		yield* patchSessionEditStatus(ctx, session._id, editStatus);

		const result = yield* incrementEditorTotalEdits(ctx, editor);

		return ok(result);
	});
}
