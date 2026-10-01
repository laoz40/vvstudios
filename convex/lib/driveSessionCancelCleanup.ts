import { ok, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

// Convex only: drops saved session-folder links and session numbers on driveSessions.
export function clearSessionDriveDb(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return ok(null);

		return okOrThrow(
			ctx.db
				.patch(driveSession._id, {
					sessionFolder: undefined,
					rawMediaFolder: undefined,
					deliverablesFolder: undefined,
					packageSessionNumber: undefined,
					clientSessionNumber: undefined,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}
