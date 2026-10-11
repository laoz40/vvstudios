import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	listBookingsAssignedToEditor,
	patchBookingAssignedEditorDisplayName
} from "#convex/editor/lib/editorAssignments";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";

export function writeBookingsAssignedEditorDisplayName(
	ctx: MutationCtx,
	editorTokenIdentifier: string,
	assignedEditorDisplayName: string
) {
	return listBookingsAssignedToEditor(ctx, editorTokenIdentifier).andThen((bookings) =>
		updateBookingsAssignedEditorDisplayName(ctx, bookings, assignedEditorDisplayName)
	);
}

export function updateBookingsAssignedEditorDisplayName(
	ctx: MutationCtx,
	bookings: Doc<"bookings">[],
	assignedEditorDisplayName: string
) {
	return ResultAsync.combine(
		bookings.map((booking) =>
			searchBlobPatchForBookingAsync(ctx, booking, { assignedEditorDisplayName }).andThen(
				(searchBlobPatch) =>
					patchBookingAssignedEditorDisplayName(ctx, booking._id, searchBlobPatch)
			)
		)
	).map(() => null);
}
