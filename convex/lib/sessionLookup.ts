import { err, ok, ResultAsync } from "neverthrow";
import { err as tupleErr, ok as tupleOk, type Result } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";

export function getSessionFromDbResult(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return ResultAsync.fromSafePromise(ctx.db.get(bookingId)).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(session);
	});
}

export function getSessionByStripeSessionIdResult(ctx: MutationCtx, stripeSessionId: string) {
	return ResultAsync.fromSafePromise(
		ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", stripeSessionId)
			)
			.unique()
	).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(session);
	});
}

export async function getSessionFromDb(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const session = await ctx.db.get(bookingId);

	if (!session) {
		return tupleErr({ reason: "BOOKING_NOT_FOUND" });
	}

	return tupleOk(session);
}

export async function getSessionFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const session: Doc<"bookings"> | null = await ctx.runQuery(internal.sessions.getSessionById, {
		bookingId
	});

	if (!session) {
		return tupleErr({ reason: "BOOKING_NOT_FOUND" });
	}

	return tupleOk(session);
}
