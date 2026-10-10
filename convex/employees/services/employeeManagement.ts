import { okAsync, ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { internal } from "#convex/_generated/api";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	assertEditorProfileFound,
	getEditorWorkStatus,
	listEditorProfiles,
	lookupEditorProfileByToken,
	patchEditorAccess,
	patchEditorNotes
} from "#convex/editor/lib/editorAccess";
import {
	listBookingsAssignedToEditor,
	patchBookingEditorAssignment
} from "#convex/editor/lib/editorAssignments";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";

type EmployeeWorkStatus = "assigned" | "editing" | "unassigned";

function mapEditorWithWorkStatus(editor: Doc<"editorProfiles">, workStatus: EmployeeWorkStatus) {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		isActive: editor.isActive,
		lastAssignedAt: editor.lastAssignedAt,
		notes: editor.notes,
		totalEdits: editor.totalEdits,
		workStatus
	};
}

function loadEditorWithWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return getEditorWorkStatus(ctx, editor.tokenIdentifier).map((workStatus: EmployeeWorkStatus) =>
		mapEditorWithWorkStatus(editor, workStatus)
	);
}

function loadEachEditorWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return loadEditorWithWorkStatus(ctx, editor);
}

function combineEditorWorkStatuses(ctx: QueryCtx, editors: Doc<"editorProfiles">[]) {
	return ResultAsync.combine(
		editors.map((editor: Doc<"editorProfiles">) => loadEachEditorWorkStatus(ctx, editor))
	);
}

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEditorProfiles(ctx).andThen((editors: Doc<"editorProfiles">[]) =>
		combineEditorWorkStatuses(ctx, editors)
	);
}

function requireEditorProfileByToken(ctx: MutationCtx, tokenIdentifier: string) {
	return lookupEditorProfileByToken(ctx, tokenIdentifier).andThen(assertEditorProfileFound);
}

function patchEmployeeAccess(ctx: MutationCtx, isActive: boolean, editor: Doc<"editorProfiles">) {
	return patchEditorAccess(ctx, editor._id, isActive);
}

function patchIncompleteBookingAssignment(
	ctx: MutationCtx,
	booking: Doc<"bookings">,
	searchBlobPatch: BookingSearchBlobPatch
) {
	return patchBookingEditorAssignment(ctx, booking._id, {
		adminNotes: booking.adminNotes,
		assignedEditorTokenIdentifier: undefined,
		searchBlobPatch
	});
}

function clearIncompleteBookingAssignment(ctx: MutationCtx, booking: Doc<"bookings">) {
	return searchBlobPatchForBookingAsync(ctx, {
		...booking,
		assignedEditorTokenIdentifier: undefined,
		assignedEditorDisplayName: undefined
	}).andThen((patch) => patchIncompleteBookingAssignment(ctx, booking, patch));
}

function unassignIncompleteBookingRows(ctx: MutationCtx, bookings: Doc<"bookings">[]) {
	const incompleteBookings = bookings.filter((booking) => booking.editStatus !== "completed");

	return ResultAsync.combine(
		incompleteBookings.map((booking) => clearIncompleteBookingAssignment(ctx, booking))
	).map(() => null);
}

function unassignIncompleteBookings(ctx: MutationCtx, tokenIdentifier: string) {
	return listBookingsAssignedToEditor(ctx, tokenIdentifier).andThen((bookings) =>
		unassignIncompleteBookingRows(ctx, bookings)
	);
}

function scheduleEditorDriveRetirement(ctx: MutationCtx, tokenIdentifier: string) {
	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.drive.drive.retireEditorDriveAccess, {
				editorTokenIdentifier: tokenIdentifier
			})
			.then(() => null)
	);
}

function retireEditorAccess(ctx: MutationCtx, tokenIdentifier: string) {
	return unassignIncompleteBookings(ctx, tokenIdentifier).andThen(() =>
		scheduleEditorDriveRetirement(ctx, tokenIdentifier)
	);
}

function patchEmployeeNotes(ctx: MutationCtx, notes: string, editor: Doc<"editorProfiles">) {
	return patchEditorNotes(ctx, editor._id, notes);
}

export function saveEmployeeAccess(
	ctx: MutationCtx,
	tokenIdentifier: string,
	isActive: boolean
): ResultAsync<null, { reason: "EDITOR_NOT_FOUND" }> {
	return requireEditorProfileByToken(ctx, tokenIdentifier)
		.andThen((editor) => patchEmployeeAccess(ctx, isActive, editor))
		.andThen(() => finishEmployeeAccessChange(ctx, tokenIdentifier, isActive));
}

function finishEmployeeAccessChange(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return isActive ? okAsync(null) : retireEditorAccess(ctx, tokenIdentifier);
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(
		(editor: Doc<"editorProfiles">) => patchEmployeeNotes(ctx, notes, editor)
	);
}
