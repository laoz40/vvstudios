import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getAdminIdentity } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessionLookup";

type SaveSessionInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };
type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };
type UpdateSessionPaidStatusArgs = { bookingId: Id<"bookings">; paidRemainingBalance: boolean };
type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "completed";
};
type MarkSessionCalendarEventDeletedArgs = { bookingId: Id<"bookings"> };

export function saveSessionInstagramHandleService(
	ctx: MutationCtx,
	args: SaveSessionInstagramHandleArgs
) {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen((session) => {
			if (session.status !== "confirmed" && session.status !== "email_failed") {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}
			return ok(session);
		})
		.andThen((session) =>
			okOrThrow(
				ctx.db.patch(session._id, { instagramHandle: args.instagramHandle }).then(() => null)
			)
		);
}

export function archiveSessionService(ctx: MutationCtx, args: ArchiveSessionArgs) {
	return getAdminIdentity(ctx)
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.bookingId, { hiddenAt: args.archived ? Date.now() : undefined })
					.then(() => null)
			)
		);
}

export function updateSessionPaidStatusService(
	ctx: MutationCtx,
	args: UpdateSessionPaidStatusArgs
) {
	return getAdminIdentity(ctx)
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			okOrThrow(
				ctx.db
					.patch(session._id, { paidRemainingBalance: args.paidRemainingBalance })
					.then(() => null)
			)
		);
}

export function updateSessionEditStatusService(
	ctx: MutationCtx,
	args: UpdateSessionEditStatusArgs
) {
	return getAdminIdentity(ctx)
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			okOrThrow(ctx.db.patch(session._id, { editStatus: args.editStatus }).then(() => null))
		);
}

export function markSessionCalendarEventDeletedService(
	ctx: MutationCtx,
	args: MarkSessionCalendarEventDeletedArgs
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					bookingFailureCode: undefined,
					googleCalendarId: undefined,
					googleEventId: undefined,
					status: "cancelled"
				})
				.then(() => null)
		)
	);
}
