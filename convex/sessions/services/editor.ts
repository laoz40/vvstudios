import { ok, ResultAsync, safeTry } from "neverthrow";
import type { PaginationOptions } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	loadEditorAssignmentOption,
	listActiveEditorProfiles
} from "#convex/editor/lib/editorAssignments";
import {
	paginateBookingsForAssigneeEditor,
	visibleEditorSessions
} from "#convex/editor/lib/editorSessions";
import { loadEditorSessionDriveFolders } from "#convex/drive/services/editorDriveFolders";
import { loadSessionEditSummaries } from "#convex/editor/lib/edits";
import { requirePermission } from "#convex/shared/services/auth";

export function listActiveEditorsForAdmin(ctx: QueryCtx) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "assign:session-editor");
		const editors = yield* listActiveEditorProfiles(ctx);

		const options = yield* ResultAsync.combine(
			editors.map((editor) => loadEditorAssignmentOption(ctx, editor))
		);

		return ok(options);
	});
}

function loadEditorDashboardRow(ctx: QueryCtx, session: Doc<"bookings">) {
	return ResultAsync.combine([
		loadEditorSessionDriveFolders(ctx, session),
		loadSessionEditSummaries(ctx, session)
	]).map(([driveFolders, edits]) => ({
		_id: session._id,
		name: session.name,
		accountName: session.accountName,
		notes: session.notes,
		adminNotes: session.adminNotes,
		editorDueDate: session.editorDueDate,
		editorNotes: session.editorNotes,
		deliverablesClientNotes: session.deliverablesClientNotes,
		deliverablesDriveLink: session.deliverablesDriveLink,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		essentialEditQuantity: session.essentialEditQuantity,
		completeEditQuantity: session.completeEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		handcraftedClipsQuantity: session.handcraftedClipsQuantity,
		editStatus: session.editStatus,
		editDeliveryMode: session.editDeliveryMode,
		driveFolders,
		edits
	}));
}

export function listEditorSessionsForAssignee(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "view:sessions");

		const bookingsPage = yield* paginateBookingsForAssigneeEditor(
			ctx,
			identity.tokenIdentifier,
			paginationOpts
		);

		const visibleSessions = visibleEditorSessions(bookingsPage.page);

		const page = yield* ResultAsync.combine(
			visibleSessions.map((session) => loadEditorDashboardRow(ctx, session))
		);

		return ok({ ...bookingsPage, page });
	});
}
