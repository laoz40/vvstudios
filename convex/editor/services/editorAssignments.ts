import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const bookings = yield* listBookingsAssignedToEditor(ctx, editorTokenIdentifier);

		const result = yield* updateBookingsAssignedEditorDisplayName(
			ctx,
			bookings,
			assignedEditorDisplayName
		);

		return ok(result);
	});
}

export function updateBookingsAssignedEditorDisplayName(
	ctx: MutationCtx,
	bookings: Doc<"bookings">[],
	assignedEditorDisplayName: string
) {
	return ResultAsync.combine(
		bookings.map((booking) =>
			safeTry(async function* () {
				const searchBlobPatch = yield* searchBlobPatchForBookingAsync(ctx, booking, {
					assignedEditorDisplayName
				});

				yield* patchBookingAssignedEditorDisplayName(ctx, booking._id, searchBlobPatch);

				return ok(null);
			})
		)
	).map(() => null);
}
