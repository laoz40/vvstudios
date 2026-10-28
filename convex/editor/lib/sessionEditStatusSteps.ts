import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { lookupEditorProfileByToken } from "#convex/editor/lib/editorAssignments";

export function loadEditorForCompletedTransition(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: NonNullable<Doc<"bookings">["editStatus"]>
): ResultAsync<Doc<"editorProfiles"> | null, never> {
	const token = session.assignedEditorTokenIdentifier;

	return editStatus !== "completed" || session.editStatus === "completed" || token === undefined
		? okAsync(null)
		: lookupEditorProfileByToken(ctx, token);
}
