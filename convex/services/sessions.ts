import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { getSessionFromDbResult } from "../lib/sessionLookup";

type SaveSessionInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };
type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };
type UpdateSessionPaidStatusArgs = { bookingId: Id<"bookings">; paidRemainingBalance: boolean };
type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "completed";
};

export function saveSessionInstagramHandleService(
	ctx: MutationCtx,
	args: SaveSessionInstagramHandleArgs
) {
	return ResultAsync.fromSafePromise(
		ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique()
	)
		.andThen((session) => {
			if (session === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
			if (session.status !== "confirmed" && session.status !== "email_failed") {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}
			return ok(session);
		})
		.andThen((session) =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(session._id, { instagramHandle: args.instagramHandle });
					return null;
				})()
			)
		);
}

export function archiveSessionService(ctx: MutationCtx, args: ArchiveSessionArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getSessionFromDbResult(ctx, args.bookingId))
		.andThen(() =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(args.bookingId, { hiddenAt: args.archived ? Date.now() : undefined });
					return null;
				})()
			)
		);
}

export function updateSessionPaidStatusService(
	ctx: MutationCtx,
	args: UpdateSessionPaidStatusArgs
) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getSessionFromDbResult(ctx, args.bookingId))
		.andThen((session) =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(session._id, { paidRemainingBalance: args.paidRemainingBalance });
					return null;
				})()
			)
		);
}

export function updateSessionEditStatusService(
	ctx: MutationCtx,
	args: UpdateSessionEditStatusArgs
) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getSessionFromDbResult(ctx, args.bookingId))
		.andThen((session) =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(session._id, { editStatus: args.editStatus });
					return null;
				})()
			)
		);
}
