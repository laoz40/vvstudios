import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getBookingRow,
	getBookingRowForAction,
	lookupBookingByStripeSessionId,
	requireBookingRow
} from "#convex/sessions/lib/lookup";

export function getSessionFromDb(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const booking = yield* getBookingRow(ctx, bookingId);
		const session = yield* requireBookingRow(booking);

		return ok(session);
	});
}

export function getSessionByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return safeTry(async function* () {
		const booking = yield* lookupBookingByStripeSessionId(ctx, stripeSessionId);
		const session = yield* requireBookingRow(booking);

		return ok(session);
	});
}

export function getSessionFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }> {
	return safeTry(async function* () {
		const booking = yield* getBookingRowForAction(ctx, bookingId);
		const session = yield* requireBookingRow(booking);

		return ok(session);
	});
}
