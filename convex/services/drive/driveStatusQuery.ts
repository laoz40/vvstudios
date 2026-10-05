import { okAsync, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { buildDriveStatusFromSetup, getDriveSetupEntities } from "#convex/lib/drive/driveStatus";
import type { DriveSetupInfo } from "#convex/lib/drive/driveLookup";
import { resolveSessionFolderDisplayName } from "#convex/lib/drive/sessionFolders/resolveFolderNames";
import { getDriveSetup } from "#convex/services/drive/driveInternal";

function mapSessionFolderNameToDriveStatus(setupInfo: DriveSetupInfo | null) {
	return (sessionFolderName: string | undefined) =>
		buildDriveStatusFromSetup(setupInfo, sessionFolderName);
}

function resolveDriveStatusWithFolderName(ctx: QueryCtx) {
	return (setupInfo: DriveSetupInfo | null) => {
		const { booking, driveSession } = getDriveSetupEntities(setupInfo);

		if (booking === null) {
			return okAsync(buildDriveStatusFromSetup(setupInfo, undefined));
		}

		return ResultAsync.fromSafePromise(
			resolveSessionFolderDisplayName(ctx, booking, driveSession)
		).map(mapSessionFolderNameToDriveStatus(setupInfo));
	};
}

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen(resolveDriveStatusWithFolderName(ctx));
}
