import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const editors = yield* listEditorProfiles(ctx);
		const workStatuses = yield* combineEditorWorkStatuses(ctx, editors);

		return ok(workStatuses);
	});
}

function requireEditorProfileByToken(ctx: MutationCtx, tokenIdentifier: string) {
	return safeTry(async function* () {
		const editor = yield* lookupEditorProfileByToken(ctx, tokenIdentifier);
		const foundEditor = yield* assertEditorProfileFound(editor);

		return ok(foundEditor);
	});
}

function clearIncompleteBookingAssignment(ctx: MutationCtx, booking: Doc<"bookings">) {
	return safeTry(async function* () {
		const searchBlobPatch = yield* buildUnassignedBookingSearchPatch(ctx, booking);

		const updatedBooking = yield* patchBookingEditorAssignment(ctx, booking._id, {
			adminNotes: booking.adminNotes,
			assignedEditorTokenIdentifier: undefined,
			searchBlobPatch
		});

		return ok(updatedBooking);
	});
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
	return safeTry(async function* () {
		const editor = yield* requireEditorProfileByToken(ctx, tokenIdentifier);
		yield* patchEditorAccess(ctx, editor._id, isActive);
		const result = yield* finishEmployeeAccessChange(ctx, tokenIdentifier, isActive);

		return ok(result);
	});
}

function finishEmployeeAccessChange(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return safeTry(async function* () {
		const retiredBookings = yield* loadBookingsForEmployeeAccessChange(
			ctx,
			tokenIdentifier,
			isActive
		);

		yield* unassignIncompleteBookingRows(ctx, retiredBookings);
		const result = yield* scheduleEditorDriveRetirement(ctx, isActive ? null : tokenIdentifier);

		return ok(result);
	});
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return safeTry(async function* () {
		const editor = yield* requireEditorProfileByToken(ctx, tokenIdentifier);
		const result = yield* patchEditorNotes(ctx, editor._id, notes);

		return ok(result);
	});
}
