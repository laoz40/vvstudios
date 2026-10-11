import { okAsync, type ResultAsync } from "neverthrow";
import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getEditorByToken,
	getEditorDetailsForIdentity,
	isAdminIdentity,
	saveEditorDetails
} from "#convex/shared/lib/auth";
import {
	editorProfileDisplayName,
	listBookingsAssignedToEditor
} from "#convex/editor/lib/editorAssignments";

export function loadSignedInEditor(
	ctx: MutationCtx,
	identity: UserIdentity
): ResultAsync<Doc<"editorProfiles"> | null, never> {
	if (isAdminIdentity(identity)) return okAsync(null);

	return getEditorByToken(ctx, identity.tokenIdentifier);
}

export function saveSignedInEditorDetails(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	if (isAdminIdentity(identity)) return okAsync(null);

	return saveEditorDetails(ctx, identity, editor);
}

export function assignedEditorNameForIdentity(identity: UserIdentity) {
	return editorProfileDisplayName(getEditorDetailsForIdentity(identity));
}

export function listBookingsForChangedEditorName(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
): ResultAsync<Doc<"bookings">[], never> {
	if (
		editor === null ||
		assignedEditorNameForIdentity(identity) === editorProfileDisplayName(editor)
	)
		return okAsync([]);

	return listBookingsAssignedToEditor(ctx, editor.tokenIdentifier);
}
