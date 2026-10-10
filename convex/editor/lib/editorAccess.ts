import { err, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

const EDITOR_LIMIT = 200;

export function assertEditorProfileFound(editor: Doc<"editorProfiles"> | null) {
	if (editor === null) {
		return err({ reason: "EDITOR_NOT_FOUND" as const });
	}

	return ok(editor);
}

const ASSIGNED_SESSION_LIMIT = 500;

type EditorWorkStatus = "assigned" | "editing" | "unassigned";

export function listEditorProfiles(ctx: QueryCtx) {
	return okOrThrow(ctx.db.query("editorProfiles").take(EDITOR_LIMIT));
}

function isCurrentAssignedSession(booking: Doc<"bookings">) {
	if (booking.editStatus === "completed") {
		return false;
	}

	return booking.status === "confirmed" || booking.status === "email_failed";
}

export function getEditorWorkStatus(
	ctx: QueryCtx,
	tokenIdentifier: string
): ResultAsync<EditorWorkStatus, never> {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
				query.eq("assignedEditorTokenIdentifier", tokenIdentifier)
			)
			.take(ASSIGNED_SESSION_LIMIT)
	).map((assignedBookings) => {
		let hasAssignedSession = false;

		for (const booking of assignedBookings) {
			if (!isCurrentAssignedSession(booking)) continue;
			hasAssignedSession = true;

			if (booking.editStatus === "editing") return "editing";
		}

		return hasAssignedSession ? "assigned" : "unassigned";
	});
}

export function lookupEditorProfileByToken(ctx: MutationCtx, tokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
			.unique()
	);
}

export function patchEditorAccess(
	ctx: MutationCtx,
	editorId: Id<"editorProfiles">,
	isActive: boolean
) {
	return okOrThrow(ctx.db.patch("editorProfiles", editorId, { isActive }).then(() => null));
}

export function patchEditorNotes(ctx: MutationCtx, editorId: Id<"editorProfiles">, notes: string) {
	return okOrThrow(
		ctx.db.patch("editorProfiles", editorId, { notes: notes.trim() || undefined }).then(() => null)
	);
}
