import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import {
	getTomorrowTimeZoneDayRange,
	REMINDER_BATCH_SIZE,
	REMINDER_TIME_ZONE
} from "#convex/lib/reminderScheduleTime";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import type { QueryCtx } from "#convex/_generated/server";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

export function getTomorrowSessionReminderWindow(nowDate: Date) {
	return getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
}

export function listConfirmedSessionsDueForReminderEmail(
	ctx: QueryCtx,
	args: { dayStart: number; dayEnd: number; limit?: number }
): import("neverthrow").ResultAsync<Doc<"bookings">[], never> {
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

export function claimSessionReminderEmail(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId)
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
					.patch("bookings", args.bookingId, {
						reminderEmailClaimedAt: args.now,
						reminderEmailFailureCode: undefined
					})
					.then(() => ({ session }))
			)
		);
}

export function writeSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("bookings", args.bookingId, {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: args.now,
					reminderEmailFailureCode: undefined
				})
				.then(() => null)
		)
	);
}

export function writeSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("bookings", args.bookingId, {
					reminderEmailClaimedAt: undefined,
					reminderEmailFailureCode: args.failureCode
				})
				.then(() => null)
		)
	);
}
