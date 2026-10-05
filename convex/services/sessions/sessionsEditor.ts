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
	return listActiveEditorProfiles(ctx);
}

function projectSingleActiveEditorStep(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return buildActiveEditorProjection(ctx, editor);
}

function projectActiveEditorsStep(ctx: QueryCtx, editors: Doc<"editorProfiles">[]) {
	return ResultAsync.combine(
		editors.map((editor: Doc<"editorProfiles">) => projectSingleActiveEditorStep(ctx, editor))
	);
}

export function listActiveEditorsForAdmin(ctx: QueryCtx) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => loadActiveEditorProfilesStep(ctx))
		.andThen((editors: Doc<"editorProfiles">[]) => projectActiveEditorsStep(ctx, editors));
}

function paginateEditorSessionsStep(
	ctx: QueryCtx,
	paginationOpts: PaginationOptions,
	identity: UserIdentity
) {
	return paginateBookingsForAssigneeEditor(ctx, identity.tokenIdentifier, paginationOpts);
}

function projectSessionWithDriveFoldersStep(
	session: Doc<"bookings">,
	driveFolders: Awaited<ReturnType<typeof getEditorSessionDriveFolders>>
) {
	return buildEditorSessionProjection(session, driveFolders);
}

function buildEditorSessionRowStep(ctx: QueryCtx, session: Doc<"bookings">) {
	return ResultAsync.fromPromise(getEditorSessionDriveFolders(ctx, session), () => null).map(
		(driveFolders: Awaited<ReturnType<typeof getEditorSessionDriveFolders>>) =>
			projectSessionWithDriveFoldersStep(session, driveFolders)
	);
}

function replaceEditorSessionsPageStep<T extends { page: Doc<"bookings">[] }>(
	bookingsPage: T,
	page: ReturnType<typeof buildEditorSessionProjection>[]
) {
	return { ...bookingsPage, page };
}

function buildEditorSessionsPageStep(
	ctx: QueryCtx,
	bookingsPage: PaginationResult<Doc<"bookings">>
) {
	const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

	return ResultAsync.combine(
		visibleSessions.map((session: Doc<"bookings">) => buildEditorSessionRowStep(ctx, session))
	).map((page: ReturnType<typeof buildEditorSessionProjection>[]) =>
		replaceEditorSessionsPageStep(bookingsPage, page)
	);
}

export function listEditorSessionsForAssignee(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return requirePermission(ctx, "view:sessions")
		.andThen((identity: UserIdentity) => paginateEditorSessionsStep(ctx, paginationOpts, identity))
		.andThen((bookingsPage: PaginationResult<Doc<"bookings">>) =>
			buildEditorSessionsPageStep(ctx, bookingsPage)
		);
}
