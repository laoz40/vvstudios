import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function markBookingSessionCalendarDeleted(
	ctx: ActionCtx,
	bookingId: Doc<"bookings">["_id"]
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.admin.markSessionCalendarEventDeleted, { bookingId })
	);
}
