import { internal } from "#convex/_generated/api";
import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function clearSessionDriveDb(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.clearSessionDriveDb, { bookingId })
	);
}

export function clearSessionDriveDbIfRequested(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	shouldClear: boolean
) {
	return shouldClear ? clearSessionDriveDb(ctx, bookingId) : okAsync(null);
}

export function cancelledSessionFolderId(setupInfo: DriveSetupInfo | null) {
	return setupInfo?.driveSession?.sessionFolder?.id ?? null;
}
