import { err, ok, type Result } from "neverthrow";
import { liftPromise } from "#convex/lib/result";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getEditorWorkStatus } from "#convex/lib/editor/editorAccess";
import { okOrThrow } from "#convex/lib/result";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearch/adminSearchBlob";

const ACTIVE_EDITOR_LIMIT = 200;

export function editorProfileDisplayName(
	editor: Pick<Doc<"editorProfiles">, "displayName" | "email">
) {
	return editor.displayName || editor.email;
}

export async function patchBookingsAssignedEditorDisplayName(
	ctx: MutationCtx,
	editorTokenIdentifier: string,
	assignedEditorDisplayName: string
) {
	const bookings = await ctx.db
		.query("bookings")
		.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
			query.eq("assignedEditorTokenIdentifier", editorTokenIdentifier)
		)
		.collect();

	await Promise.all(
		bookings.map(async (booking) => {
			const searchBlobPatch = await searchBlobPatchForBooking(ctx, booking, {
				assignedEditorDisplayName
			});

			return ctx.db.patch("bookings", booking._id, searchBlobPatch);
		})
	);
}

export function listActiveEditorProfiles(ctx: QueryCtx) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_isActive", (query) => query.eq("isActive", true))
			.take(ACTIVE_EDITOR_LIMIT)
	);
}

export async function getEditorDisplayNamesByToken(ctx: QueryCtx, tokenIdentifiers: string[]) {
	const displayNamesByToken = new Map<string, string>();

	await Promise.all(
		tokenIdentifiers.map(async (tokenIdentifier) => {
			const editor = await ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
				.unique();

			if (editor === null) {
				return;
			}

			displayNamesByToken.set(tokenIdentifier, editor.displayName || editor.email);
		})
	);

	return displayNamesByToken;
}

// TODO(scale): This indexed lookup runs once per active editor; persist workload counters if that becomes inefficient at scale.
export async function buildActiveEditorProjection(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		totalEdits: editor.totalEdits,
		workStatus: await getEditorWorkStatus(ctx, editor.tokenIdentifier)
	};
}

export function buildActiveEditorProjectionAsync(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return liftPromise(buildActiveEditorProjection(ctx, editor));
}

export function getActiveEditor(ctx: MutationCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", editorTokenIdentifier)
			)
			.unique()
	).andThen((editor) => {
		if (editor === null || !editor.isActive) {
			return err({ reason: "EDITOR_NOT_ACTIVE" as const });
		}

		return ok(editor);
	});
}

function isEditorAssignableSession(session: Doc<"bookings">): boolean {
	return session.status === "confirmed" || session.status === "email_failed";
}

function requireEditorAssignableSession(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "SESSION_NOT_ASSIGNABLE" }> {
	if (!isEditorAssignableSession(session)) {
		return err({ reason: "SESSION_NOT_ASSIGNABLE" as const });
	}

	return ok(session);
}

function saveSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
) {
	return okOrThrow(
		(async () => {
			const previousEditorTokenIdentifier = session.assignedEditorTokenIdentifier;

			const assignedEditorDisplayName =
				editor !== undefined ? editorProfileDisplayName(editor) : undefined;

			const searchBlobPatch = await searchBlobPatchForBooking(ctx, {
				...session,
				assignedEditorTokenIdentifier: editor?.tokenIdentifier,
				assignedEditorDisplayName
			});

			await ctx.db.patch("bookings", session._id, {
				adminNotes: adminNotes.trim() || undefined,
				assignedEditorTokenIdentifier: editor?.tokenIdentifier,
				...searchBlobPatch
			});

			// Assignment and the editor's latest-assignment timestamp are saved in one transaction.
			if (editor !== undefined) {
				await ctx.db.patch("editorProfiles", editor._id, { lastAssignedAt: Date.now() });
			}

			const editorChanged = previousEditorTokenIdentifier !== editor?.tokenIdentifier;

			const previousEditorNeedsAccessRemoved =
				previousEditorTokenIdentifier !== undefined && editorChanged;

			// Reassignment and unassignment must remove the previous editor before adding new access.
			if (previousEditorNeedsAccessRemoved) {
				await ctx.scheduler.runAfter(0, internal.drive.updateEditorDriveAccess, {
					bookingId: session._id,
					previousEditorTokenIdentifier
				});
			}

			const isFirstAssignment = previousEditorTokenIdentifier === undefined && editor !== undefined;

			// A first assignment has no old Drive access to remove.
			if (isFirstAssignment) {
				await ctx.scheduler.runAfter(0, internal.drive.setupEditorAccess, {
					bookingId: session._id
				});
			}

			return null;
		})()
	);
}

export function updateSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorTokenIdentifier: string | null,
	adminNotes: string
) {
	if (editorTokenIdentifier === null) {
		return saveSessionEditorAssignment(ctx, session, undefined, adminNotes);
	}

	return requireEditorAssignableSession(session)
		.asyncAndThen(() => getActiveEditor(ctx, editorTokenIdentifier))
		.andThen((editor) => saveSessionEditorAssignment(ctx, session, editor, adminNotes));
}
