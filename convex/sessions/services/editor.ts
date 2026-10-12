import { ok, ResultAsync, safeTry } from "neverthrow";
import type { PaginationOptions, PaginationResult } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles
} from "#convex/editor/lib/editorAssignments";
import {
	buildEditorSessionProjection,
	paginateBookingsForAssigneeEditor,
	visibleEditorSessions
} from "#convex/editor/lib/editorSessions";
import { loadEditorSessionDriveFolders } from "#convex/drive/services/editorDriveFolders";
import { requirePermission } from "#convex/shared/services/auth";

function projectActiveEditorsStep(ctx: QueryCtx, editors: Doc<"editorProfiles">[]) {
	return ResultAsync.combine(
		editors.map((editor: Doc<"editorProfiles">) => buildActiveEditorProjection(ctx, editor))
	);
}

export function listActiveEditorsForAdmin(ctx: QueryCtx) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "assign:session-editor");
		const editors = yield* listActiveEditorProfiles(ctx);

		return ok(yield* projectActiveEditorsStep(ctx, editors));
	});
}

function buildEditorSessionRowStep(ctx: QueryCtx, session: Doc<"bookings">) {
	return loadEditorSessionDriveFolders(ctx, session).map((driveFolders) =>
		buildEditorSessionProjection(session, driveFolders)
	);
}

function buildEditorSessionsPageStep(
	ctx: QueryCtx,
	bookingsPage: PaginationResult<Doc<"bookings">>
) {
	const visibleSessions = visibleEditorSessions(bookingsPage.page);

	return ResultAsync.combine(
		visibleSessions.map((session: Doc<"bookings">) => buildEditorSessionRowStep(ctx, session))
	).map((page: ReturnType<typeof buildEditorSessionProjection>[]) => ({ ...bookingsPage, page }));
}

export function listEditorSessionsForAssignee(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "view:sessions");

		const bookingsPage = yield* paginateBookingsForAssigneeEditor(
			ctx,
			identity.tokenIdentifier,
			paginationOpts
		);

		return ok(yield* buildEditorSessionsPageStep(ctx, bookingsPage));
	});
}
