import { ResultAsync } from "neverthrow";
import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "#convex/_generated/server";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles
} from "#convex/lib/editor/editorAssignments";
import {
	buildEditorSessionProjection,
	isEditorVisibleSession,
	paginateBookingsForAssigneeEditor
} from "#convex/lib/editor/editorSessions";
import { getEditorSessionDriveFolders } from "#convex/lib/drive/driveStatus";
import { requirePermission } from "#convex/services/auth";

export function listActiveEditorsForAdmin(ctx: QueryCtx) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => listActiveEditorProfiles(ctx))
		.andThen((editors) =>
			ResultAsync.combine(editors.map((editor) => buildActiveEditorProjection(ctx, editor)))
		);
}

export function listEditorSessionsForAssignee(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return requirePermission(ctx, "view:sessions")
		.andThen((identity) =>
			paginateBookingsForAssigneeEditor(ctx, identity.tokenIdentifier, paginationOpts)
		)
		.andThen((bookingsPage) => {
			const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

			return ResultAsync.combine(
				visibleSessions.map((session) =>
					ResultAsync.fromPromise(getEditorSessionDriveFolders(ctx, session), () => null).map(
						(driveFolders) => buildEditorSessionProjection(session, driveFolders)
					)
				)
			).map((page) => ({ ...bookingsPage, page }));
		});
}
