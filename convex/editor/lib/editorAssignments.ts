import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getEditorWorkStatus } from "#convex/editor/lib/editorAccess";
import { err, ok, type Result } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import { type BookingSearchBlobPatch } from "#convex/shared/lib/adminSearch/adminSearchBlob";

const ACTIVE_EDITOR_LIMIT = 200;

export function requireActiveEditor(
	editor: Doc<"editorProfiles"> | null
): Result<Doc<"editorProfiles">, { reason: "EDITOR_NOT_ACTIVE" }> {
	if (editor === null || !editor.isActive) {
		return err({ reason: "EDITOR_NOT_ACTIVE" as const });
	}

	return ok(editor);
}

export function editorProfileDisplayName(
	editor: Pick<Doc<"editorProfiles">, "displayName" | "email">
) {
	return editor.displayName || editor.email;
}

export function listBookingsAssignedToEditor(ctx: MutationCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
				query.eq("assignedEditorTokenIdentifier", editorTokenIdentifier)
			)
			.collect()
	);
}

export function patchBookingAssignedEditorDisplayName(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	searchBlobPatch: BookingSearchBlobPatch
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, searchBlobPatch).then(() => null));
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
export function loadEditorAssignmentOption(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return getEditorWorkStatus(ctx, editor.tokenIdentifier).map((workStatus) => ({
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		totalEdits: editor.totalEdits,
		workStatus
	}));
}

export function lookupEditorProfileByToken(ctx: MutationCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", editorTokenIdentifier)
			)
			.unique()
	);
}

export function patchBookingEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	patch: {
		adminNotes?: string;
		editorDueDate?: string;
		assignedEditorDisplayName?: string;
		assignedEditorTokenIdentifier?: string;
		editStatusScope?: Doc<"bookings">["editStatusScope"];
		editDeliveryMode?: Doc<"bookings">["editDeliveryMode"];
		editStatus?: Doc<"bookings">["editStatus"];
		searchBlobPatch: BookingSearchBlobPatch;
	}
) {
	const editStatusScope =
		patch.editStatusScope ??
		session.editStatusScope ??
		(session.assignedEditorTokenIdentifier === undefined ? undefined : "session");

	return okOrThrow(
		ctx.db
			.patch("bookings", session._id, {
				adminNotes: patch.adminNotes,
				editorDueDate:
					editStatusScope === "edit"
						? (patch.editorDueDate ?? session.editorDueDate)
						: patch.editorDueDate,
				assignedEditorDisplayName: patch.assignedEditorDisplayName,
				assignedEditorTokenIdentifier: patch.assignedEditorTokenIdentifier,
				editStatusScope,
				editDeliveryMode: patch.editDeliveryMode ?? session.editDeliveryMode,
				editStatus: patch.editStatus ?? session.editStatus,
				...patch.searchBlobPatch
			})
			.then(() => null)
	);
}

export function patchEditorProfileLastAssignedAt(
	ctx: MutationCtx,
	editorProfileId: Id<"editorProfiles">
) {
	return okOrThrow(
		ctx.db.patch("editorProfiles", editorProfileId, { lastAssignedAt: Date.now() }).then(() => null)
	);
}

export function scheduleEditorDriveAccessUpdate(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	previousEditorTokenIdentifier: string
) {
	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.drive.drive.updateEditorDriveAccess, {
				bookingId,
				previousEditorTokenIdentifier
			})
			.then(() => null)
	);
}

export function scheduleEditorDriveAccessSetup(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.drive.drive.setupEditorAccess, { bookingId })
			.then(() => null)
	);
}
