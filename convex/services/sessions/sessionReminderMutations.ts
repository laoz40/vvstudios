import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getTomorrowTimeZoneDayRange, REMINDER_TIME_ZONE } from "#convex/lib/reminderScheduleTime";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	listConfirmedSessionsDueForReminderEmailRows,
	patchSessionReminderEmailClaimed,
	patchSessionReminderEmailFailed,
	patchSessionReminderEmailSent
} from "#convex/lib/sessions/sessionReminderDb";
import type { QueryCtx } from "#convex/_generated/server";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

export function getTomorrowSessionReminderWindow(nowDate: Date) {
	return getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
}

export function listConfirmedSessionsDueForReminderEmail(
	ctx: QueryCtx,
	args: { dayStart: number; dayEnd: number; limit?: number }
): import("neverthrow").ResultAsync<Doc<"bookings">[], never> {
	return listConfirmedSessionsDueForReminderEmailRows(ctx, args);
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
		.andThen((session) => patchSessionReminderEmailClaimed(ctx, args).map(() => ({ session })));
}

export function writeSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		patchSessionReminderEmailSent(ctx, args)
	);
}

export function writeSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		patchSessionReminderEmailFailed(ctx, args)
	);
}
