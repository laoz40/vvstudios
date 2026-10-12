import { ok, ResultAsync, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	buildDriveStatusFromSetup,
	selectDriveSetupsForStatus
} from "#convex/drive/lib/driveStatus";
import { resolveSessionFolderDisplayName } from "#convex/drive/services/sessionFolderNames";
import { getDriveSetup } from "#convex/drive/services/setup";

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const setupInfo = yield* getDriveSetup(ctx, bookingId);
		const fallbackStatus = buildDriveStatusFromSetup(setupInfo);

		const statuses = yield* ResultAsync.combine(
			selectDriveSetupsForStatus(setupInfo).map((setup) =>
				safeTry(async function* () {
					const folderName = yield* resolveSessionFolderDisplayName(
						ctx,
						setup.booking,
						setup.driveSession
					);

					return ok(buildDriveStatusFromSetup(setup, folderName));
				})
			)
		);

		return ok(statuses[0] ?? fallbackStatus);
	});
}
