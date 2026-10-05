import { ResultAsync } from "neverthrow";
import type { UserIdentity } from "convex/server";
import type { PaginationOptions, PaginationResult } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
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

function loadActiveEditorProfilesStep(ctx: QueryCtx) {
	return () => listActiveEditorProfiles(ctx);
}

function projectSingleActiveEditorStep(ctx: QueryCtx) {
	return (editor: Doc<"editorProfiles">) => buildActiveEditorProjection(ctx, editor);
}

function projectActiveEditorsStep(ctx: QueryCtx) {
	return (editors: Doc<"editorProfiles">[]) =>
		ResultAsync.combine(editors.map(projectSingleActiveEditorStep(ctx)));
}

export function listActiveEditorsForAdmin(ctx: QueryCtx) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(loadActiveEditorProfilesStep(ctx))
		.andThen(projectActiveEditorsStep(ctx));
}

function paginateEditorSessionsStep(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return (identity: UserIdentity) =>
		paginateBookingsForAssigneeEditor(ctx, identity.tokenIdentifier, paginationOpts);
}

function projectSessionWithDriveFoldersStep(session: Doc<"bookings">) {
	return (driveFolders: Awaited<ReturnType<typeof getEditorSessionDriveFolders>>) =>
		buildEditorSessionProjection(session, driveFolders);
}

function buildEditorSessionRowStep(ctx: QueryCtx) {
	return (session: Doc<"bookings">) =>
		ResultAsync.fromPromise(getEditorSessionDriveFolders(ctx, session), () => null).map(
			projectSessionWithDriveFoldersStep(session)
		);
}

function replaceEditorSessionsPageStep<T extends { page: Doc<"bookings">[] }>(bookingsPage: T) {
	return (page: ReturnType<typeof buildEditorSessionProjection>[]) => ({ ...bookingsPage, page });
}

function buildEditorSessionsPageStep(ctx: QueryCtx) {
	return (bookingsPage: PaginationResult<Doc<"bookings">>) => {
		const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

		return ResultAsync.combine(visibleSessions.map(buildEditorSessionRowStep(ctx))).map(
			replaceEditorSessionsPageStep(bookingsPage)
		);
	};
}

export function listEditorSessionsForAssignee(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return requirePermission(ctx, "view:sessions")
		.andThen(paginateEditorSessionsStep(ctx, paginationOpts))
		.andThen(buildEditorSessionsPageStep(ctx));
}
