import { err, ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

const EDITOR_LIMIT = 200;
const ASSIGNED_SESSION_LIMIT = 500;

type EditorWorkStatus = "assigned" | "editing" | "unassigned";

export function listEditorProfiles(ctx: QueryCtx) {
	return okOrThrow(ctx.db.query("editorProfiles").take(EDITOR_LIMIT));
}

function isCurrentAssignedSession(booking: Doc<"bookings">) {
	return (
		(booking.status === "confirmed" || booking.status === "email_failed") &&
		booking.hiddenAt === undefined
	);
}

export async function getEditorWorkSummary(
	ctx: QueryCtx,
	tokenIdentifier: string
): Promise<{ totalEdits: number; workStatus: EditorWorkStatus }> {
	const assignedBookings = await ctx.db
		.query("bookings")
		.withIndex("by_assignedEditorTokenIdentifier", (query) =>
			query.eq("assignedEditorTokenIdentifier", tokenIdentifier)
		)
		.take(ASSIGNED_SESSION_LIMIT);

	let hasAssignedSession = false;
	for (const booking of assignedBookings) {
		if (!isCurrentAssignedSession(booking)) continue;
		hasAssignedSession = true;
		if (booking.editStatus === "editing") {
			return { totalEdits: assignedBookings.length, workStatus: "editing" };
		}
	}

	return {
		totalEdits: assignedBookings.length,
		workStatus: hasAssignedSession ? "assigned" : "unassigned"
	};
}

export async function buildEditorManagementProjection(
	ctx: QueryCtx,
	editor: Doc<"editorProfiles">
) {
	const workSummary = await getEditorWorkSummary(ctx, editor.tokenIdentifier);

	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		isActive: editor.isActive,
		lastAssignedAt: editor.lastAssignedAt,
		notes: editor.notes,
		...workSummary
	};
}

function getEditorProfile(ctx: MutationCtx, tokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
			.unique()
	).andThen((editor) => {
		if (editor === null) return err({ reason: "EDITOR_NOT_FOUND" as const });
		return ok(editor);
	});
}

export function updateEditorAccess(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return getEditorProfile(ctx, tokenIdentifier).andThen((editor) =>
		okOrThrow(ctx.db.patch(editor._id, { isActive }).then(() => null))
	);
}

export function updateEditorNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return getEditorProfile(ctx, tokenIdentifier).andThen((editor) =>
		okOrThrow(ctx.db.patch(editor._id, { notes: notes.trim() || undefined }).then(() => null))
	);
}
