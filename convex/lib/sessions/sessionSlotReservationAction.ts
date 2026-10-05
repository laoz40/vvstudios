import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";

export function runReserveSessionReservation(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		sessionStartAt: number;
	}
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
			bookingId: args.bookingId,
			duration: args.duration,
			eventBufferMinutes: args.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: args.sessionStartAt
		})
	);
}
