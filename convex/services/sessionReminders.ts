import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDbResult } from "#convex/lib/sessionLookup";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

export function claimReminderService(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDbResult(ctx, args.bookingId)
		.andThen((session) => {
			if (session.status !== "confirmed" && session.status !== "email_failed") {
				return err({ reason: "BOOKING_NOT_SENDABLE" as const });
			}

			if (session.reminderEmailSentAt || session.reminderEmailClaimedAt) {
				return err({ reason: "BOOKING_ALREADY_CLAIMED_OR_SENT" as const });
			}

			return ok(session);
		})
		.andThen((session) =>
			okOrThrow(
				ctx.db
					.patch(args.bookingId, {
						reminderEmailClaimedAt: args.now,
						reminderEmailFailureCode: undefined
					})
					.then(() => ({ session }))
			)
		);
}

export function markReminderSentService(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDbResult(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: args.now,
					reminderEmailFailureCode: undefined
				})
				.then(() => null)
		)
	);
}

export function markReminderFailedService(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return getSessionFromDbResult(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					reminderEmailClaimedAt: undefined,
					reminderEmailFailureCode: args.failureCode
				})
				.then(() => null)
		)
	);
}
