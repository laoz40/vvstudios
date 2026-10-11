import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";

import {
	assertEditorProfileFound,
	listEditorProfiles,
	lookupEditorProfileByToken,
	getEditorWorkStatus,
	patchEditorAccess,
	patchEditorNotes
} from "#convex/editor/lib/editorAccess";
import { patchBookingEditorAssignment } from "#convex/editor/lib/editorAssignments";
import {
	buildUnassignedBookingSearchPatch,
	loadBookingsForEmployeeAccessChange,
	selectIncompleteBookings,
	scheduleEditorDriveRetirement
} from "#convex/employees/lib/employeeManagementSteps";

function combineEditorWorkStatuses(ctx: QueryCtx, editors: Doc<"editorProfiles">[]) {
	return ResultAsync.combine(
		editors.map((editor: Doc<"editorProfiles">) =>
			getEditorWorkStatus(ctx, editor.tokenIdentifier).map((workStatus) => ({
				tokenIdentifier: editor.tokenIdentifier,
				displayName: editor.displayName,
				email: editor.email,
				isActive: editor.isActive,
				lastAssignedAt: editor.lastAssignedAt,
				notes: editor.notes,
				totalEdits: editor.totalEdits,
				workStatus
			}))
		)
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

function clearIncompleteBookingAssignment(ctx: MutationCtx, booking: Doc<"bookings">) {
	return buildUnassignedBookingSearchPatch(ctx, booking).andThen((searchBlobPatch) =>
		patchBookingEditorAssignment(ctx, booking._id, {
			adminNotes: booking.adminNotes,
			assignedEditorTokenIdentifier: undefined,
			searchBlobPatch
		})
	);
}

function unassignIncompleteBookingRows(ctx: MutationCtx, bookings: Doc<"bookings">[]) {
	return ResultAsync.combine(
		selectIncompleteBookings(bookings).map((booking) =>
			clearIncompleteBookingAssignment(ctx, booking)
		)
	).map(() => null);
}

export function saveEmployeeAccess(
	ctx: MutationCtx,
	tokenIdentifier: string,
	isActive: boolean
): ResultAsync<null, { reason: "EDITOR_NOT_FOUND" }> {
	return requireEditorProfileByToken(ctx, tokenIdentifier)
		.andThen((editor) => patchEditorAccess(ctx, editor._id, isActive))
		.andThen(() => finishEmployeeAccessChange(ctx, tokenIdentifier, isActive));
}

function finishEmployeeAccessChange(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return loadBookingsForEmployeeAccessChange(ctx, tokenIdentifier, isActive)
		.andThen((retiredBookings) => unassignIncompleteBookingRows(ctx, retiredBookings))
		.andThen(() => scheduleEditorDriveRetirement(ctx, isActive ? null : tokenIdentifier));
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(
		(editor: Doc<"editorProfiles">) => patchEditorNotes(ctx, editor._id, notes)
	);
}
