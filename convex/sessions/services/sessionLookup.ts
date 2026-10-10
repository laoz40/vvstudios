import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	getBookingRow,
	lookupBookingByStripeSessionId,
	requireBookingRow
} from "#convex/sessions/lib/sessionLookup";

export function getSessionFromDb(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId).andThen(requireBookingRow);
}

export function getSessionByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).andThen(requireBookingRow);
}

export function getSessionFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }> {
	return okOrThrow(ctx.runQuery(internal.sessions.sessions.getSessionById, { bookingId })).andThen(
		requireBookingRow
	);
}
