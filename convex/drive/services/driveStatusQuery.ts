import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { buildDriveStatusFromSetup, getDriveSetupEntities } from "#convex/drive/lib/driveStatus";
import type { DriveSetupInfo } from "#convex/drive/lib/driveLookup";
import { loadSessionFolderDisplayName } from "#convex/drive/lib/sessionFolders/resolveFolderNames";
import { getDriveSetup } from "#convex/drive/services/driveInternal";

function mapSessionFolderNameToDriveStatus(
	setupInfo: DriveSetupInfo | null,
	sessionFolderName: string | undefined
) {
	return buildDriveStatusFromSetup(setupInfo, sessionFolderName);
}

function resolveDriveStatusWithFolderName(ctx: QueryCtx, setupInfo: DriveSetupInfo | null) {
	const { booking, driveSession } = getDriveSetupEntities(setupInfo);

	if (booking === null) {
		return okAsync(buildDriveStatusFromSetup(setupInfo, undefined));
	}

	return loadSessionFolderDisplayName(ctx, booking, driveSession).map((sessionFolderName) =>
		mapSessionFolderNameToDriveStatus(setupInfo, sessionFolderName)
	);
}

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setupInfo: DriveSetupInfo | null) =>
		resolveDriveStatusWithFolderName(ctx, setupInfo)
	);
}
