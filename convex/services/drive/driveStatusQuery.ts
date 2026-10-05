import { okAsync, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { buildDriveStatusFromSetup, getDriveSetupEntities } from "#convex/lib/drive/driveStatus";
import { resolveSessionFolderDisplayName } from "#convex/lib/drive/sessionFolders/resolveFolderNames";
import { getDriveSetup } from "#convex/services/drive/driveInternal";

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setupInfo) => {
		const { booking, driveSession } = getDriveSetupEntities(setupInfo);

		if (booking === null) {
			return okAsync(buildDriveStatusFromSetup(setupInfo, undefined));
		}

		return ResultAsync.fromSafePromise(
			resolveSessionFolderDisplayName(ctx, booking, driveSession)
		).map((sessionFolderName) => buildDriveStatusFromSetup(setupInfo, sessionFolderName));
	});
}
