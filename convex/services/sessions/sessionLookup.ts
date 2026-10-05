import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { getBookingRow, lookupBookingByStripeSessionId } from "#convex/lib/sessions/sessionLookup";

export function getSessionFromDb(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(session);
	});
}

export function getSessionByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(session);
	});
}

export function getSessionFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }> {
	return okOrThrow(ctx.runQuery(internal.sessions.getSessionById, { bookingId })).andThen(
		(session) => {
			if (!session) {
				return err({ reason: "BOOKING_NOT_FOUND" as const });
			}

			return ok(session);
		}
	);
}
