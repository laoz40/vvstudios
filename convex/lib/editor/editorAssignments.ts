import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getEditorWorkStatus } from "#convex/lib/editor/editorAccess";
import { okOrThrow } from "#convex/lib/result";
import {
	type BookingSearchBlobPatch,
	searchBlobPatchForBooking
} from "#convex/lib/adminSearch/adminSearchBlob";

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
		assignedEditorTokenIdentifier?: string;
		searchBlobPatch: BookingSearchBlobPatch;
	}
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", bookingId, {
				adminNotes: patch.adminNotes,
				assignedEditorTokenIdentifier: patch.assignedEditorTokenIdentifier,
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
			.runAfter(0, internal.drive.updateEditorDriveAccess, {
				bookingId,
				previousEditorTokenIdentifier
			})
			.then(() => null)
	);
}

export function scheduleEditorDriveAccessSetup(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.scheduler.runAfter(0, internal.drive.setupEditorAccess, { bookingId }).then(() => null)
	);
}
