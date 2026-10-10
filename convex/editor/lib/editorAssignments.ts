import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getEditorWorkStatus } from "#convex/editor/lib/editorAccess";
import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	type BookingSearchBlobPatch,
	searchBlobPatchForBookingAsync
} from "#convex/shared/lib/adminSearch/adminSearchBlob";

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

function patchBookingAssignedEditorDisplayName(
	ctx: MutationCtx,
	booking: Doc<"bookings">,
	assignedEditorDisplayName: string
) {
	return searchBlobPatchForBookingAsync(ctx, booking, { assignedEditorDisplayName }).andThen(
		(searchBlobPatch) =>
			okOrThrow(ctx.db.patch("bookings", booking._id, searchBlobPatch).then(() => null))
	);
}

function writeBookingsAssignedEditorDisplayNameChain(
	ctx: MutationCtx,
	editorTokenIdentifier: string,
	assignedEditorDisplayName: string
) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
				query.eq("assignedEditorTokenIdentifier", editorTokenIdentifier)
			)
			.collect()
	).andThen((bookings) =>
		bookings.length === 0
			? okAsync(null)
			: ResultAsync.combine(
					bookings.map((booking) =>
						patchBookingAssignedEditorDisplayName(ctx, booking, assignedEditorDisplayName)
					)
				).map(() => null)
	);
}

export function writeBookingsAssignedEditorDisplayName(
	ctx: MutationCtx,
	editorTokenIdentifier: string,
	assignedEditorDisplayName: string
) {
	return writeBookingsAssignedEditorDisplayNameChain(
		ctx,
		editorTokenIdentifier,
		assignedEditorDisplayName
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
export function buildActiveEditorProjection(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
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
	bookingId: Id<"bookings">,
	patch: {
		adminNotes?: string;
		assignedEditorDisplayName?: string;
		assignedEditorTokenIdentifier?: string;
		searchBlobPatch: BookingSearchBlobPatch;
	}
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", bookingId, {
				adminNotes: patch.adminNotes,
				assignedEditorDisplayName: patch.assignedEditorDisplayName,
				assignedEditorTokenIdentifier: patch.assignedEditorTokenIdentifier,
				...patch.searchBlobPatch
			})
			.then(() => null)
	);
}

export function listBookingsAssignedToEditor(ctx: MutationCtx, tokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
				query.eq("assignedEditorTokenIdentifier", tokenIdentifier)
			)
			.collect()
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
