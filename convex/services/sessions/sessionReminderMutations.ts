import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getTomorrowTimeZoneDayRange, REMINDER_TIME_ZONE } from "#convex/lib/reminderScheduleTime";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
import {
	patchSessionReminderEmailClaimed,
	patchSessionReminderEmailFailed,
	patchSessionReminderEmailSent,
	takeConfirmedBookingsInReminderWindow
} from "#convex/lib/sessions/sessionReminderDb";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

function requireSendableUnclaimedReminder(session: Doc<"bookings">) {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_SENDABLE" as const });
	}

	if (session.reminderEmailSentAt || session.reminderEmailClaimedAt) {
		return err({ reason: "BOOKING_ALREADY_CLAIMED_OR_SENT" as const });
	}

	return ok(session);
}

function pairClaimedSessionStep(session: Doc<"bookings">) {
	return { session };
}

function claimReminderAfterSessionStep(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number },

	session: Doc<"bookings">
) {
	return patchSessionReminderEmailClaimed(ctx, args).map(() => pairClaimedSessionStep(session));
}

function patchReminderSentStep(ctx: MutationCtx, args: ReminderBookingArgs & { now: number }) {
	return patchSessionReminderEmailSent(ctx, args);
}

function patchReminderFailedStep(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return patchSessionReminderEmailFailed(ctx, args);
}

export function getTomorrowSessionReminderWindow(nowDate: Date) {
	return getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
}

export function listConfirmedSessionsDueForReminderEmail(
	ctx: QueryCtx,
	args: { dayStart: number; dayEnd: number; limit?: number }
) {
	return takeConfirmedBookingsInReminderWindow(ctx, args);
}

export function claimSessionReminderEmail(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId)
		.andThen(requireSendableUnclaimedReminder)
		.andThen((session: Doc<"bookings">) => claimReminderAfterSessionStep(ctx, args, session));
}

export function writeSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() => patchReminderSentStep(ctx, args));
}

export function writeSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() => patchReminderFailedStep(ctx, args));
}
