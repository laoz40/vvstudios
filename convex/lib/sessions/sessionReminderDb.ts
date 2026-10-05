import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { REMINDER_BATCH_SIZE } from "#convex/lib/reminderScheduleTime";
import { okOrThrow } from "#convex/lib/result";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

export function takeConfirmedBookingsInReminderWindow(
	ctx: QueryCtx,
	args: { dayStart: number; dayEnd: number; limit?: number }
) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_status_and_reminderEmailSentAt_and_sessionStartAt", (indexQuery) =>
				indexQuery
					.eq("status", "confirmed")
					.eq("reminderEmailSentAt", undefined)
					.gte("sessionStartAt", args.dayStart)
					.lt("sessionStartAt", args.dayEnd)
			)
			.take(args.limit ?? REMINDER_BATCH_SIZE)
	);
}

export function patchSessionReminderEmailClaimed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				reminderEmailClaimedAt: args.now,
				reminderEmailFailureCode: undefined
			})
			.then(() => null)
	);
}

export function patchSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				reminderEmailClaimedAt: undefined,
				reminderEmailSentAt: args.now,
				reminderEmailFailureCode: undefined
			})
			.then(() => null)
	);
}

export function patchSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				reminderEmailClaimedAt: undefined,
				reminderEmailFailureCode: args.failureCode
			})
			.then(() => null)
	);
}
