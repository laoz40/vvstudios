import { okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { internal } from "#convex/_generated/api";
import { okOrThrow } from "#convex/shared/lib/result";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { listBookingsAssignedToEditor } from "#convex/editor/lib/editorAssignments";

export function selectIncompleteBookings(bookings: Doc<"bookings">[]) {
	return bookings.filter((booking) => booking.editStatus !== "completed");
}

export function loadBookingsForEmployeeAccessChange(
	ctx: MutationCtx,
	tokenIdentifier: string,
	isActive: boolean
) {
	return isActive
		? okAsync<Doc<"bookings">[]>([])
		: listBookingsAssignedToEditor(ctx, tokenIdentifier);
}

export function buildUnassignedBookingSearchPatch(ctx: MutationCtx, booking: Doc<"bookings">) {
	return searchBlobPatchForBookingAsync(ctx, {
		...booking,
		assignedEditorTokenIdentifier: undefined,
		assignedEditorDisplayName: undefined
	});
}

export function scheduleEditorDriveRetirement(ctx: MutationCtx, tokenIdentifier: string | null) {
	if (tokenIdentifier === null) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.drive.drive.retireEditorDriveAccess, {
				editorTokenIdentifier: tokenIdentifier
			})
			.then(() => null)
	);
}
