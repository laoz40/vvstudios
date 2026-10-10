import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export function clearSessionDriveDbForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<null, never> {
	if (driveSession === null) return okAsync(null);

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				sessionFolder: undefined,
				rawMediaFolder: undefined,
				deliverablesFolder: undefined,
				packageSessionNumber: undefined,
				clientSessionNumber: undefined,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}
