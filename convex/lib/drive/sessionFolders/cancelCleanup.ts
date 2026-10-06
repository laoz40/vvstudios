import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";

export function clearSessionDriveDb(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.clearSessionDriveDb, { bookingId })
	);
}
