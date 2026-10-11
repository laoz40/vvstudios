import { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	buildDriveStatusFromSetup,
	selectDriveSetupsForStatus
} from "#convex/drive/lib/driveStatus";
import type { DriveSetupInfo } from "#convex/drive/lib/driveLookup";
import { resolveSessionFolderDisplayName } from "#convex/drive/services/sessionFolderNames";
import { getDriveSetup } from "#convex/drive/services/setup";

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setupInfo: DriveSetupInfo | null) => {
		const fallbackStatus = buildDriveStatusFromSetup(setupInfo);

		return ResultAsync.combine(
			selectDriveSetupsForStatus(setupInfo).map((setup) =>
				resolveSessionFolderDisplayName(ctx, setup.booking, setup.driveSession).map((folderName) =>
					buildDriveStatusFromSetup(setup, folderName)
				)
			)
		).map((statuses) => statuses[0] ?? fallbackStatus);
	});
}
